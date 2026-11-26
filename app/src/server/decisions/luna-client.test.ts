import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigCache } from "@/server/config/config";
import { LunaUnavailableError } from "@/server/http/errors";
import { loadCapture } from "../../../tests/helpers/captures";
import { captureLogs, type CapturedLogs } from "../../../tests/helpers/log-capture";
import { buildQuestions, buildStateText } from "./questions";
import { buildLunaRequestBody, callLuna } from "./luna-client";

const KEY = "sk-or-v1-testkey-0123456789abcdef";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const questions = buildQuestions("RETURN", "SMARTPHONE", "Smartfon testowy");
const stateText = buildStateText({ caseType: "RETURN", category: "SMARTPHONE", model: "Smartfon testowy" });

interface LunaCapture {
  status: number;
  body: { answers: Record<string, unknown>; usage?: unknown; [k: string]: unknown };
}
const RETURN_PHONE = loadCapture<LunaCapture>("llm", "luna-return-phone-1");
const COMPLAINT_LAPTOP = loadCapture<LunaCapture>("llm", "luna-complaint-laptop-2");
const complaintQuestions = buildQuestions("COMPLAINT", "LAPTOP", "Laptop testowy");
const complaintStateText = buildStateText({
  caseType: "COMPLAINT",
  category: "LAPTOP",
  model: "Laptop testowy",
  reason: "Ekran miga",
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let logs: CapturedLogs;
beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", KEY);
  vi.stubEnv("VISION_MODEL", "v/model");
  vi.stubEnv("DECISION_MODEL", "d/model");
  vi.stubEnv("LUNA_MODEL", "openai/gpt-6-luna-decisions");
  resetConfigCache();
  logs = captureLogs();
});
afterEach(() => {
  logs.restore();
  vi.unstubAllEnvs();
  resetConfigCache();
});

const base = { caseId: "case-1", questions, stateText, imageJpeg: JPEG, timeoutMs: 1000 };

describe("buildLunaRequestBody", () => {
  it("builds model, state (text + image_url data URL), questions map and session_id", () => {
    const body = buildLunaRequestBody({ model: "m/x", stateText: "S", imageJpeg: JPEG, questions, caseId: "c1" }) as Record<string, unknown>;
    expect(body.model).toBe("m/x");
    expect(body.session_id).toBe("c1");
    const state = body.state as unknown[];
    expect(state[0]).toBe("S");
    expect(state[1]).toEqual({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${JPEG.toString("base64")}` },
    });
    const qs = body.questions as Record<string, Record<string, unknown>>;
    expect(Object.keys(qs)).toEqual(questions.map((q) => q.key));
    expect(qs.signs_of_use).toMatchObject({ type: "score" });
    expect(qs.signs_of_use.criteria).toEqual(questions[2].criteria);
    expect(qs.signs_of_use).not.toHaveProperty("key");
  });
});

describe("callLuna", () => {
  it("POSTs to the decisions endpoint with Bearer auth and maps the real return/phone-1 capture", async () => {
    const fetchImpl = vi.fn(async () => json(RETURN_PHONE.body, RETURN_PHONE.status));
    const res = await callLuna({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string).model).toBe("openai/gpt-6-luna-decisions");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(res.answers.map((a) => a.key)).toEqual(["device_matches", "photo_assessable", "signs_of_use"]);
    expect(res.answers[0]).toMatchObject({ type: "noul", value: true, certainty: 0.98 });
    expect(res.answers[1]).toMatchObject({ type: "noul", value: true, certainty: 0.94 });
    expect(res.answers[2]).toMatchObject({ type: "score", value: 3, certainty: 1 });
    expect(res.costUsd).toBe(0);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.raw).toEqual(RETURN_PHONE.body);
  });

  it("maps the real complaint/laptop-2 capture: a low-confidence choice stays a choice with its certainty", async () => {
    const fetchImpl = async () => json(COMPLAINT_LAPTOP.body, COMPLAINT_LAPTOP.status);
    const res = await callLuna({
      ...base,
      questions: complaintQuestions,
      stateText: complaintStateText,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.answers.map((a) => a.key)).toEqual([
      "device_matches",
      "photo_assessable",
      "defect_visibility",
      "damage_cause",
    ]);
    expect(res.answers[2]).toMatchObject({ type: "choice", value: "not_visible", certainty: 0.37 });
    expect(res.answers[3]).toMatchObject({ type: "choice", value: "no_visible_damage", certainty: 0.88 });
    expect(res.costUsd).toBe(0);
  });

  it("maps a refusal and a missing key to refusal/missing answers; costUsd null when absent", async () => {
    // derived-from: luna-return-phone-1 (device_matches replaced by a refusal, signs_of_use and usage removed)
    const kept = structuredClone(RETURN_PHONE.body);
    delete kept.usage;
    delete kept.answers.signs_of_use;
    kept.answers.device_matches = { type: "refusal" };
    const derived = kept;
    const fetchImpl = async () => json(derived);
    const res = await callLuna({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.answers[0]).toMatchObject({ key: "device_matches", type: "refusal", value: null });
    expect(res.answers[1]).toMatchObject({ type: "noul", value: true });
    expect(res.answers[2]).toMatchObject({ key: "signs_of_use", type: "missing", value: null });
    expect(res.costUsd).toBeNull();
  });

  it("throws LunaUnavailableError on HTTP 500", async () => {
    const fetchImpl = async () => json({ error: { code: 500, message: "Internal Server Error" } }, 500);
    await expect(callLuna({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toBeInstanceOf(
      LunaUnavailableError,
    );
  });

  it("throws LunaUnavailableError on timeout", async () => {
    const fetchImpl = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(init.signal?.reason ?? new Error("aborted")));
      });
    await expect(
      callLuna({ ...base, timeoutMs: 20, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(LunaUnavailableError);
  });

  it("throws LunaUnavailableError on malformed JSON", async () => {
    // derived-from: luna-return-phone-1 (200 status, body truncated mid-JSON)
    const truncated = JSON.stringify(RETURN_PHONE.body).slice(0, 40);
    const fetchImpl = async () => new Response(truncated, { status: RETURN_PHONE.status });
    await expect(callLuna({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toBeInstanceOf(
      LunaUnavailableError,
    );
  });

  it("throws LunaUnavailableError when the body does not match the schema", async () => {
    // derived-from: luna-return-phone-1 (answers removed)
    const noAnswers = structuredClone(RETURN_PHONE.body) as Partial<LunaCapture["body"]>;
    delete noAnswers.answers;
    const fetchImpl = async () => json(noAnswers);
    await expect(callLuna({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toBeInstanceOf(
      LunaUnavailableError,
    );
  });

  it("throws LunaUnavailableError when fetch itself fails", async () => {
    const fetchImpl = async () => {
      throw new Error("network disabled in tests");
    };
    await expect(callLuna({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toBeInstanceOf(
      LunaUnavailableError,
    );
  });

  it("never logs the key or the image data", async () => {
    const fetchImpl = async () => json({ error: { code: 401, message: "Missing Authentication header" } }, 401);
    await callLuna({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }).catch(() => undefined);
    const text = logs.text();
    expect(text).not.toContain(KEY);
    expect(text).not.toContain(JPEG.toString("base64"));
  });
});
