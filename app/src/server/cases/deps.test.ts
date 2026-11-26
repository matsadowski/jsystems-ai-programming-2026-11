// Composition root: the real AI ports are wired (no "not wired" stubs) and the Luna port maps a
// `callLuna` result to a LunaAssessment. `callLuna` is our own function (the Luna provider is down,
// D9, so there is no real Luna capture); it is replaced here only to assert the mapping.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeImage } from "@/server/ai/analyst";
import { decideWithLlm } from "@/server/ai/decision";
import { resetConfigCache } from "@/server/config/config";
import { toLunaAnswer } from "@/server/decisions/certainty";
import { QUESTIONS_VERSION } from "@/server/decisions/questions";
import type { LunaResult } from "@/server/decisions/luna-client";
import type { ProcessedImage } from "@/server/domain";
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
    expect(promptVersions.chat).toBe("chat-system@2");
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
