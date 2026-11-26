// chatStream integration tests: the decision model is replayed from the real chat captures
// (chat-plain, chat-revise: tool call + continuation). Derived variants change only the tool input.
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigCache } from "@/server/config/config";
import { computeDecisionFacts, type Case, type Decision } from "@/server/domain";
import { getPolicy } from "@/server/policies/policies";
import { InMemoryCaseRepository } from "@/server/store/in-memory-case-repository";
import { loadCapture } from "../../../tests/helpers/captures";
import { fixedClock } from "../../../tests/helpers/clock";
import { replayStream, type RecordedStream } from "../../../tests/helpers/replay";
import { chatStream, stripReasoning } from "./chat";
import { resetModels, setModelsForTests } from "./models";
import { MockLanguageModelV4 } from "ai/test";

const NOW = "2026-11-26T10:00:00Z";
const TODAY = "2026-11-26";
const clock = fixedClock(NOW);

const decision = (over: Partial<Decision> = {}): Decision => ({
  decision: "NEEDS_MANUAL_REVIEW",
  citedClauses: ["C4.1", "C4.2"],
  justification: ["Brak opisu usterki."],
  nextSteps: ["Poproś o opis usterki."],
  missingEvidence: ["Brak opisu usterki."],
  confidence: "HIGH",
  source: "MODEL",
  violationsOnFirstAttempt: [],
  ...over,
});

function makeCase(over: { purchaseDate?: string; caseType?: "RETURN" | "COMPLAINT" } = {}): Case {
  const caseType = over.caseType ?? "COMPLAINT";
  const purchaseDate = over.purchaseDate ?? "2025-06-01";
  const d =
    caseType === "COMPLAINT"
      ? decision()
      : decision({ decision: "ACCEPT", citedClauses: ["R1.1"], missingEvidence: [], source: "RULES" });
  return {
    id: "6f1d5d7e-4f0e-4b0e-9f3a-1c2d3e4f5a6b",
    status: "DECIDED",
    input: {
      caseType,
      category: caseType === "COMPLAINT" ? "LAPTOP" : "SMARTPHONE",
      model: "Urządzenie testowe",
      purchaseDate,
      reason: "Laptop się wyłącza po kilku minutach pracy",
    },
    imageMeta: { originalFormat: "jpeg", originalWidth: 800, originalHeight: 600, originalByteSize: 1, width: 800, height: 600, byteSize: 1 },
    analysis: null,
    facts: computeDecisionFacts(caseType, purchaseDate, TODAY),
    decision: d,
    decisionHistory: [{ decision: d, at: NOW, trigger: "INITIAL" }],
    messages: [{ id: "m-first", role: "assistant", parts: [{ type: "text", text: "Pierwsza wiadomość z decyzją." }] }],
    policyVersion: "p1",
    promptVersions: { vision: "v@1", decision: "d@1", chat: "chat-system@3" },
    decisionPath: "RULES",
    lunaAssessment: null,
    shadow: null,
    chatInProgress: false,
    chatStartedAt: null,
    createdAt: NOW,
    lastAccessAt: NOW,
  };
}

const userMessage = (text: string, id = "u-1"): UIMessage => ({ id, role: "user", parts: [{ type: "text", text }] });
const repoWith = (c: Case) => {
  const repo = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 10, clock });
  repo.create(c);
  return repo;
};
const idle = new MockLanguageModelV4({});
const useChatModel = (m: MockLanguageModelV4) => setModelsForTests({ vision: idle, decision: m });

// derived-from: chat-revise (only the tool-call input of the first recorded call differs).
function reviseWith(input: Record<string, unknown>): RecordedStream[] {
  const calls = loadCapture<RecordedStream[]>("llm", "chat-revise");
  const [first, ...rest] = calls;
  const patched = first.map((p) => {
    if (p.type !== "tool-call") return p;
    return { ...p, input: JSON.stringify({ ...JSON.parse(p.input), ...input }) };
  });
  return [patched, ...rest];
}

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("VISION_MODEL", "test/vision");
  vi.stubEnv("DECISION_MODEL", "test/decision");
  resetConfigCache();
});
afterEach(() => {
  resetModels();
  vi.unstubAllEnvs();
  resetConfigCache();
});

const promptText = (m: MockLanguageModelV4, call = 0) => JSON.stringify(m.doStreamCalls[call].prompt);

describe("chatStream", () => {
  it("streams the recorded plain answer with the case context, history and the tool in the request", async () => {
    const model = replayStream("chat-plain");
    useChatModel(model);
    const c = makeCase();
    const result = await chatStream(c, { repo: repoWith(c), clock, userMessage: userMessage("Dlaczego taka decyzja?") });
    expect((await result.text).length).toBeGreaterThan(10);
    const call = model.doStreamCalls[0];
    const system = JSON.stringify(call.prompt[0].content);
    const policy = getPolicy("COMPLAINT", process.cwd() + "/../docs/policies");
    expect(system).toContain(JSON.stringify(policy.text).slice(1, 200));
    for (const tag of ["<case_form>", "<facts>", "<current_decision>", "<decision_history>"]) expect(system).toContain(tag);
    expect(promptText(model)).toContain("Pierwsza wiadomość z decyzją.");
    expect(promptText(model)).toContain("Dlaczego taka decyzja?");
    expect(call.tools?.map((t) => t.name)).toEqual(["reviseDecision"]);
    expect(call.providerOptions).toMatchObject({ openrouter: { reasoning: { effort: "low", exclude: true } } });
  });

  it("does not duplicate a user message that is already the last stored message (retry dedupe)", async () => {
    const model = replayStream("chat-plain");
    useChatModel(model);
    const c = makeCase();
    const u = userMessage("Powtórka pytania", "u-dup");
    c.messages = [...c.messages, u];
    const result = await chatStream(c, { repo: repoWith(c), clock, userMessage: u });
    await result.consumeStream();
    expect(promptText(model).match(/Powtórka pytania/g)).toHaveLength(1);
  });

  it("commits a successful revision through the repository immediately and continues the answer", async () => {
    const model = replayStream("chat-revise");
    useChatModel(model);
    const c = makeCase();
    const repo = repoWith(c);
    const result = await chatStream(c, {
      repo,
      clock,
      userMessage: userMessage("Klient przyznał, że zalał laptop kawą.", "u-rev"),
    });
    await result.consumeStream();
    expect(model.doStreamCalls).toHaveLength(2);
    const stored = repo.get(c.id)!;
    expect(stored.decision).toMatchObject({ decision: "REJECT", source: "CHAT_REVISION", citedClauses: ["C2.2", "C5"] });
    expect(stored.decisionHistory).toHaveLength(2);
    expect(stored.decisionHistory[1]).toMatchObject({ trigger: "CHAT_REVISION", messageId: "u-rev", at: "2026-11-26T10:00:00.000Z" });
    // The continuation call receives the tool result.
    expect(promptText(model, 1)).toContain("tool-result");
    expect(promptText(model, 1)).toContain('"ok":true');
  });

  it.each([
    ["SAME_DECISION", { newDecision: "NEEDS_MANUAL_REVIEW" }, {}],
    ["NOT_ALLOWED_FOR_CASE_TYPE", { newDecision: "ACCEPT" }, {}],
    ["UNKNOWN_CLAUSE", { citedClauses: ["C9.9"] }, {}],
    ["WINDOW_EXPIRED", { newDecision: "REPAIR", citedClauses: ["C3.1"] }, { purchaseDate: "2020-01-01" }],
  ])("returns %s to the model and leaves the case unchanged", async (error, toolInput, caseOver) => {
    const model = replayStream(reviseWith(toolInput));
    useChatModel(model);
    const c = makeCase(caseOver);
    const repo = repoWith(c);
    const result = await chatStream(c, { repo, clock, userMessage: userMessage("Nowa informacja o usterce.") });
    await result.consumeStream();
    expect(promptText(model, 1)).toContain('"ok":false');
    expect(promptText(model, 1)).toContain(error);
    const stored = repo.get(c.id)!;
    expect(stored.decision?.decision).toBe("NEEDS_MANUAL_REVIEW");
    expect(stored.decisionHistory).toHaveLength(1);
  });

  it("stripReasoning drops reasoning parts and keeps the rest", () => {
    const m: UIMessage = {
      id: "a",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "ukryte rozumowanie" },
        { type: "text", text: "Odpowiedź" },
      ],
    };
    expect(stripReasoning(m).parts).toEqual([{ type: "text", text: "Odpowiedź" }]);
  });
});
