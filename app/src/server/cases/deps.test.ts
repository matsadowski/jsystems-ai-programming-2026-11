// Composition root: the real AI ports are wired (no "not wired" stubs) and the Luna port maps a
// `callLuna` result to a LunaAssessment. The mapping tests stub `callLuna` (our own function); the
// router integration tests at the bottom replay the real Luna captures through the real `callLuna`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeImage } from "@/server/ai/analyst";
import { decideWithLlm } from "@/server/ai/decision";
import { resetConfigCache } from "@/server/config/config";
import { toLunaAnswer } from "@/server/decisions/certainty";
import { QUESTIONS_VERSION } from "@/server/decisions/questions";
import { callLuna, type LunaResult } from "@/server/decisions/luna-client";
import { routeAnalysis, routeDecision, type RouterDeps } from "@/server/decisions/router";
import { computeDecisionFacts, type Decision, type ImageAnalysis, type ProcessedImage } from "@/server/domain";
import type { CaseInput } from "@/lib/shared/case-input";
import type { DecisionMode } from "@/lib/shared/enums";
import { loadCapture } from "../../../tests/helpers/captures";
import { createAssessWithLuna, getCaseDeps } from "./deps";

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("VISION_MODEL", "test/vision");
  vi.stubEnv("DECISION_MODEL", "test/decision");
  vi.stubEnv("DECISION_MODE", "gated");
  resetConfigCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetConfigCache();
});

describe("getCaseDeps", () => {
  it("wires the real analyst and decider and the Luna port", () => {
    const deps = getCaseDeps();
    expect(deps.analyzeImage).toBe(analyzeImage);
    expect(deps.decideWithLlm).toBe(decideWithLlm);
    expect(typeof deps.assessWithLuna).toBe("function");
    expect(deps.config).toMatchObject({ decisionMode: "gated", lunaConfidenceThreshold: 0.8, lunaTimeoutMs: 5000 });
  });

  it("stores the prompt versions of both case types", () => {
    const { promptVersions } = getCaseDeps();
    expect(promptVersions.vision).toBe("vision-return@1 | vision-complaint@1");
    expect(promptVersions.decision).toBe("decision-return@1 | decision-complaint@1");
    expect(promptVersions.chat).toBe("chat-system@3");
  });
});

describe("createAssessWithLuna", () => {
  const image = { bytes: Buffer.from([1, 2, 3]) } as ProcessedImage;
  const input = {
    caseType: "RETURN",
    category: "SMARTPHONE",
    model: "Smartfon testowy",
    purchaseDate: "2026-11-23",
    reason: "",
  } as const;

  it("builds questions and state text, then maps answers, uncertainty, latency and cost", async () => {
    const calls: unknown[] = [];
    const call = async (args: unknown): Promise<LunaResult> => {
      calls.push(args);
      return {
        raw: {},
        answers: [
          toLunaAnswer("device_matches", { type: "noul", noul: 0.95 }),
          toLunaAnswer("photo_assessable", undefined),
        ],
        latencyMs: 321,
        costUsd: 0.002,
      };
    };
    const assess = createAssessWithLuna({ lunaConfidenceThreshold: 0.8, lunaTimeoutMs: 4000 }, call);
    const out = await assess({ caseId: "c-1", input, image });
    expect(calls[0]).toMatchObject({ caseId: "c-1", timeoutMs: 4000, imageJpeg: image.bytes });
    expect((calls[0] as { stateText: string }).stateText).toContain("Case type: RETURN");
    expect((calls[0] as { questions: unknown[] }).questions.length).toBeGreaterThan(0);
    expect(out).toMatchObject({
      questionsVersion: QUESTIONS_VERSION,
      latencyMs: 321,
      costUsd: 0.002,
      refusedKeys: ["photo_assessable"],
    });
    expect(out.answers).toHaveLength(2);
    expect(out.uncertainKeys).toContain("photo_assessable");
  });
});

// Router integration with real Luna answers: LunaAssessment built by the real createAssessWithLuna
// from the parsed real captures (callLuna with a fetchImpl replaying status + body).
describe("router with real Luna captures", () => {
  interface LunaCapture {
    status: number;
    body: unknown;
  }
  const image = { bytes: Buffer.from([1, 2, 3]), format: "jpeg", width: 10, height: 10, byteSize: 3 } as ProcessedImage;
  const returnInput: CaseInput = {
    caseType: "RETURN",
    category: "SMARTPHONE",
    model: "Smartfon testowy",
    purchaseDate: "2026-11-23",
    reason: "",
  };
  const complaintInput: CaseInput = {
    caseType: "COMPLAINT",
    category: "LAPTOP",
    model: "Laptop testowy",
    purchaseDate: "2026-11-23",
    reason: "Ekran miga",
  };
  const TODAY = "2026-11-26";

  const llmDecision: Decision = {
    decision: "REJECT",
    citedClauses: ["R2.3"],
    justification: ["LLM"],
    nextSteps: ["x"],
    missingEvidence: [],
    confidence: "MEDIUM",
    source: "MODEL",
    violationsOnFirstAttempt: [],
  };

  function setup(mode: DecisionMode, captureName: string) {
    const capture = loadCapture<LunaCapture>("llm", captureName);
    const fetchImpl = async () =>
      new Response(JSON.stringify(capture.body), {
        status: capture.status,
        headers: { "content-type": "application/json" },
      });
    const assessWithLuna = createAssessWithLuna(
      { lunaConfidenceThreshold: 0.8, lunaTimeoutMs: 4000 },
      (args) => callLuna({ ...args, fetchImpl: fetchImpl as unknown as typeof fetch }),
    );
    const n = { vision: 0, luna: 0, llm: 0 };
    const deps: RouterDeps = {
      mode,
      threshold: 0.8,
      lunaTimeoutMs: 4000,
      analyzeImage: async () => {
        n.vision++;
        return { summary: "fake analysis" } as unknown as ImageAnalysis;
      },
      assessWithLuna: async (args) => {
        n.luna++;
        return assessWithLuna(args);
      },
      decideWithLlm: async () => {
        n.llm++;
        return llmDecision;
      },
    };
    return { deps, n };
  }

  it("gated + return phone-1 (all certain, signs_of_use 3): FAST REJECT citing R2.1/R2.3, no vision/LLM call", async () => {
    const { deps, n } = setup("gated", "luna-return-phone-1");
    const facts = computeDecisionFacts("RETURN", returnInput.purchaseDate, TODAY);
    const routed = await routeAnalysis(deps, { caseId: "c1", input: returnInput, image, facts });
    expect(routed.decisionPath).toBe("FAST");
    expect(routed.lunaAssessment?.uncertainKeys).toEqual([]);
    expect(routed.preparedDecision).toMatchObject({ decision: "REJECT", source: "FAST" });
    expect(routed.preparedDecision?.citedClauses).toEqual(["R2.1", "R2.3"]);
    expect(n).toEqual({ vision: 0, luna: 1, llm: 0 });
  });

  it("gated + complaint laptop-2 (defect_visibility confidence 0.37): LLM_ESCALATED with defect_visibility uncertain", async () => {
    const { deps, n } = setup("gated", "luna-complaint-laptop-2");
    const facts = computeDecisionFacts("COMPLAINT", complaintInput.purchaseDate, TODAY);
    const routed = await routeAnalysis(deps, { caseId: "c2", input: complaintInput, image, facts });
    expect(routed.decisionPath).toBe("LLM_ESCALATED");
    expect(routed.lunaAssessment?.uncertainKeys).toContain("defect_visibility");
    expect(routed.preparedDecision).toBeNull();
    expect(n).toEqual({ vision: 1, luna: 1, llm: 0 });
  });

  it("shadow + return phone-1: path LLM, the fast result is stored and compared after the LLM decision", async () => {
    const { deps, n } = setup("shadow", "luna-return-phone-1");
    const facts = computeDecisionFacts("RETURN", returnInput.purchaseDate, TODAY);
    const routed = await routeAnalysis(deps, { caseId: "c3", input: returnInput, image, facts });
    expect(routed.decisionPath).toBe("LLM");
    expect(routed.shadowFast).toBe("REJECT");
    expect(routed.preparedDecision).toBeNull();
    expect(n).toEqual({ vision: 1, luna: 1, llm: 0 });

    const stored = {
      id: "c3",
      input: returnInput,
      facts,
      decisionPath: routed.decisionPath,
      analysis: routed.analysis,
      lunaAssessment: routed.lunaAssessment,
      shadow: { fastDecision: routed.shadowFast, agreesWithLlm: null },
    } as unknown as Parameters<typeof routeDecision>[1];
    const { decision, shadow } = await routeDecision(deps, stored);
    expect(decision.source).toBe("MODEL");
    expect(shadow).toEqual({ fastDecision: "REJECT", agreesWithLlm: true });
    expect(n.llm).toBe(1);
  });
});
