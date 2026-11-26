// Route-level tests of POST /api/chat: real Request objects, deps injected through
// setCaseDepsForTests, the chat model replayed from the real `chat-plain` capture.
import path from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetModels, setModelsForTests } from "@/server/ai/models";
import { setCaseDepsForTests } from "@/server/cases/deps";
import type { CaseServiceDeps } from "@/server/cases/services";
import { resetConfigCache } from "@/server/config/config";
import { computeDecisionFacts, systemClock, type Case, type Decision } from "@/server/domain";
import { InMemoryCaseRepository } from "@/server/store/in-memory-case-repository";
import { replayStream } from "../../../../tests/helpers/replay";
import { POST } from "./route";

const CASE_ID = "6f1d5d7e-4f0e-4b0e-9f3a-1c2d3e4f5a6b";
const NOW = new Date().toISOString();

const decision: Decision = {
  decision: "REJECT",
  citedClauses: ["R1.3"],
  justification: ["Termin minął."],
  nextSteps: ["Poinformuj klienta."],
  missingEvidence: [],
  confidence: "HIGH",
  source: "RULES",
  violationsOnFirstAttempt: [],
};

const decidedCase = (): Case => ({
  id: CASE_ID,
  status: "DECIDED",
  input: { caseType: "RETURN", category: "SMARTPHONE", model: "Galaxy S24", purchaseDate: "2020-01-01", reason: "" },
  imageMeta: { originalFormat: "jpeg", originalWidth: 800, originalHeight: 600, originalByteSize: 1, width: 800, height: 600, byteSize: 1 },
  analysis: null,
  facts: computeDecisionFacts("RETURN", "2020-01-01", "2026-11-26"),
  decision,
  decisionHistory: [{ decision, at: NOW, trigger: "INITIAL" }],
  messages: [{ id: "m-first", role: "assistant", parts: [{ type: "text", text: "Pierwsza wiadomość." }] }],
  policyVersion: "p1",
  promptVersions: { vision: "v@1", decision: "d@1", chat: "c@1" },
  decisionPath: "RULES",
  lunaAssessment: null,
  shadow: null,
  chatInProgress: false,
  chatStartedAt: null,
  createdAt: NOW,
  lastAccessAt: NOW,
});

let repo: InMemoryCaseRepository;

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("VISION_MODEL", "test/vision");
  vi.stubEnv("DECISION_MODEL", "test/decision");
  resetConfigCache();
  repo = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 10, clock: systemClock });
  repo.create(decidedCase());
  const fail = async () => {
    throw new Error("port must not be called");
  };
  const deps: CaseServiceDeps = {
    repo,
    clock: systemClock,
    config: {
      appTimezone: "Europe/Warsaw",
      decisionMode: "llm_only",
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
  setCaseDepsForTests(deps);
});
afterEach(() => {
  setCaseDepsForTests(null);
  resetModels();
  vi.unstubAllEnvs();
  resetConfigCache();
});

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
const message = (text: string, id = "u-1") => ({ id, role: "user", parts: [{ type: "text", text }] });

describe("POST /api/chat", () => {
  it("400 VALIDATION_ERROR for malformed JSON, with the error shape and x-request-id", async () => {
    const res = await post("{nope");
    expect(res.status).toBe(400);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("400 with fieldErrors.message for an empty message", async () => {
    const res = await post({ caseId: CASE_ID, message: message("   ") });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors.message).toBe("Wpisz wiadomość");
  });

  it("404 CASE_NOT_FOUND with the Polish message", async () => {
    const res = await post({ caseId: "00000000-0000-4000-8000-000000000000", message: message("Cześć") });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: "CASE_NOT_FOUND", message: "Sesja zgłoszenia wygasła. Rozpocznij nowe zgłoszenie." });
  });

  it("409 CASE_NOT_DECIDED and 409 CHAT_BUSY come before any stream", async () => {
    repo.update(CASE_ID, (c) => ({ ...c, status: "ANALYZED" }));
    expect((await (await post({ caseId: CASE_ID, message: message("a") })).json()).error.code).toBe("CASE_NOT_DECIDED");
    repo.update(CASE_ID, (c) => ({ ...c, status: "DECIDED" }));
    repo.tryAcquireChat(CASE_ID);
    const busy = await post({ caseId: CASE_ID, message: message("a") });
    expect(busy.status).toBe(409);
    expect((await busy.json()).error.code).toBe("CHAT_BUSY");
  });

  it("503 CONFIG_ERROR when the environment is incomplete", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    resetConfigCache();
    const res = await post({ caseId: CASE_ID, message: message("Cześć") });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("CONFIG_ERROR");
    expect(repo.get(CASE_ID)?.chatInProgress).toBe(false);
  });

  it("200 streams the recorded answer with x-request-id and the decision metadata", async () => {
    setModelsForTests({ vision: new MockLanguageModelV4({}), decision: replayStream("chat-plain") });
    const res = await post({ caseId: CASE_ID, message: message("Dlaczego taka decyzja?") });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(res.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    const body = await res.text();
    expect(body).toContain('"type":"text-delta"');
    expect(body).toContain('"messageMetadata":{"decision":{"value":"REJECT"');
    expect(repo.get(CASE_ID)?.chatInProgress).toBe(false);
  });
});
