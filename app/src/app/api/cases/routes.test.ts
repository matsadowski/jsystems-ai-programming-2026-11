// Route-level tests: exported POST handlers called with real Request objects (real image bytes).
// Deps are overridden through setCaseDepsForTests; the real wiring is covered by the env tests.
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreateCaseResponse, DecideCaseResponse } from "@/lib/shared/api";
import { resetConfigCache } from "@/server/config/config";
import { setCaseDepsForTests } from "@/server/cases/deps";
import type { CaseServiceDeps } from "@/server/cases/services";
import { systemClock } from "@/server/domain";
import { InMemoryCaseRepository } from "@/server/store/in-memory-case-repository";
import { exampleImage } from "../../../../tests/helpers/example-images";
import { POST as createCase } from "./route";
import { POST as decide } from "./[caseId]/decision/route";

const photo = (name = "phone-3.jpeg") => new File([new Uint8Array(exampleImage(name))], name, { type: "image/jpeg" });

function createRequest(over: Record<string, string> = {}, withPhoto = true): Request {
  const form = new FormData();
  const fields = {
    caseType: "RETURN",
    category: "SMARTPHONE",
    model: "Galaxy S24",
    purchaseDate: "2020-01-01",
    reason: "",
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (withPhoto) form.set("photo", photo());
  return new Request("http://localhost/api/cases", { method: "POST", body: form });
}

function testDeps(): { deps: CaseServiceDeps; calls: { n: number } } {
  const calls = { n: 0 };
  const fail = async () => {
    calls.n++;
    throw new Error("port must not be called");
  };
  const deps: CaseServiceDeps = {
    repo: new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 50, clock: systemClock }),
    clock: systemClock,
    config: {
      appTimezone: "Europe/Warsaw",
      decisionMode: "gated",
      lunaConfidenceThreshold: 0.8,
      lunaTimeoutMs: 1000,
      policyDir: path.resolve(__dirname, "../../../../../docs/policies"),
    },
    promptVersions: { vision: "v@1", decision: "d@1", chat: "c@1" },
    analyzeImage: fail,
    assessWithLuna: fail,
    decideWithLlm: fail,
    newId: () => crypto.randomUUID(),
  };
  return { deps, calls };
}

const decisionRequest = () => new Request("http://localhost/api/cases/x/decision", { method: "POST" });
const ctx = (caseId: string) => ({ params: Promise.resolve({ caseId }) });

afterEach(() => {
  setCaseDepsForTests(null);
  vi.unstubAllEnvs();
  resetConfigCache();
});

describe("POST /api/cases", () => {
  it("returns 201 with the CreateCaseResponse and x-request-id (RULES path)", async () => {
    const { deps, calls } = testDeps();
    setCaseDepsForTests(deps);
    const res = await createCase(createRequest());
    expect(res.status).toBe(201);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = (await res.json()) as CreateCaseResponse;
    expect(body).toMatchObject({ decisionPath: "RULES", analysis: null, assessment: null });
    expect(body.caseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.n).toBe(0);
  });

  it("maps validation errors to { error: { code, message, fieldErrors } } and creates no case", async () => {
    const { deps } = testDeps();
    setCaseDepsForTests(deps);
    const res = await createCase(createRequest({ model: "x" }, false));
    expect(res.status).toBe(400);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof body.error.message).toBe("string");
    expect(body.error.fieldErrors.photo).toBe("Dodaj zdjęcie sprzętu");
    expect(deps.repo.size()).toBe(0);
  });

  it("rejects a non-multipart body with 400 and the error shape", async () => {
    const { deps } = testDeps();
    setCaseDepsForTests(deps);
    const res = await createCase(
      new Request("http://localhost/api/cases", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("answers 413 for an oversized declared Content-Length", async () => {
    const { deps } = testDeps();
    setCaseDepsForTests(deps);
    const req = createRequest();
    const headers = new Headers(req.headers);
    headers.set("content-length", String(20 * 1024 * 1024));
    const big = new Request(req, { headers });
    const res = await createCase(big);
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("FILE_TOO_LARGE");
  });

  it("answers 503 CONFIG_ERROR when the environment is not configured (TAC-03)", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    resetConfigCache();
    const res = await createCase(createRequest());
    expect(res.status).toBe(503);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect((await res.json()).error.code).toBe("CONFIG_ERROR");
  });
});

describe("POST /api/cases/{caseId}/decision", () => {
  it("returns 200 with the decision and first message", async () => {
    const { deps } = testDeps();
    setCaseDepsForTests(deps);
    const created = (await (await createCase(createRequest())).json()) as CreateCaseResponse;
    const res = await decide(decisionRequest(), ctx(created.caseId));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = (await res.json()) as DecideCaseResponse;
    expect(body.decision).toMatchObject({ value: "REJECT", decisionPath: "RULES" });
    expect(body.firstMessage.parts[0].text).toContain("Uzasadnienie");
  });

  it("passes the request abort signal down to the decision port", async () => {
    const { deps } = testDeps();
    deps.config.decisionMode = "llm_only";
    deps.analyzeImage = async () => ({ summary: "x" }) as never;
    let observed: boolean | undefined;
    deps.decideWithLlm = async (args) => {
      observed = args.signal?.aborted;
      throw new Error("stop");
    };
    setCaseDepsForTests(deps);
    const today = new Date().toISOString().slice(0, 10);
    const created = (await (await createCase(createRequest({ purchaseDate: today, category: "LAPTOP" }))).json()) as CreateCaseResponse;
    const ctl = new AbortController();
    ctl.abort();
    const req = new Request("http://localhost/api/cases/x/decision", { method: "POST", signal: ctl.signal });
    await decide(req, ctx(created.caseId));
    expect(observed).toBe(true);
  });

  it("answers 404 for an unknown id and 400 for a malformed id", async () => {
    const { deps } = testDeps();
    setCaseDepsForTests(deps);
    const notFound = await decide(decisionRequest(), ctx(crypto.randomUUID()));
    expect(notFound.status).toBe(404);
    expect((await notFound.json()).error.code).toBe("CASE_NOT_FOUND");
    const bad = await decide(decisionRequest(), ctx("nope"));
    expect(bad.status).toBe(400);
    expect(bad.headers.get("x-request-id")).toBeTruthy();
    expect((await bad.json()).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("real wiring (no override)", () => {
  function stubEnv(mode: string) {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key-not-real");
    vi.stubEnv("VISION_MODEL", "vision/test");
    vi.stubEnv("DECISION_MODEL", "decision/test");
    vi.stubEnv("POLICY_DIR", path.resolve(__dirname, "../../../../../docs/policies"));
    vi.stubEnv("DECISION_MODE", mode);
    resetConfigCache();
  }

  it("RULES path works end-to-end without any AI wiring", async () => {
    stubEnv("gated");
    const created = await createCase(createRequest());
    expect(created.status).toBe(201);
    const { caseId } = (await created.json()) as CreateCaseResponse;
    const res = await decide(decisionRequest(), ctx(caseId));
    expect(res.status).toBe(200);
    expect((await res.json()).decision.value).toBe("REJECT");
  });

  it("LLM path fails cleanly with 502 AI_UNAVAILABLE until T12b and creates no case", async () => {
    stubEnv("llm_only");
    const res = await createCase(createRequest({ purchaseDate: new Date().toISOString().slice(0, 10) }));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("AI_UNAVAILABLE");
  });
});
