// Case service tests: real InMemoryCaseRepository, fixed clock, real example photos, real sharp.
// The AI and Luna ports are typed fakes of OUR OWN ports with call counters (no OpenRouter fakes).
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DecisionMode } from "@/lib/shared/enums";
import type {
  AnalyzeImage,
  AssessWithLuna,
  DecideWithLlm,
  Decision,
  ImageAnalysis,
  LunaAssessment,
} from "@/server/domain";
import { AiTimeoutError, AppError } from "@/server/http/errors";
import { InMemoryCaseRepository } from "@/server/store/in-memory-case-repository";
import { toLunaAnswer } from "@/server/decisions/certainty";
import { fixedClock } from "../../../tests/helpers/clock";
import { captureLogs } from "../../../tests/helpers/log-capture";
import { exampleImage } from "../../../tests/helpers/example-images";
import { createCaseWithAnalysis, decideCase, type CaseServiceDeps } from "./services";

const NOW = "2026-11-26T10:00:00Z";

interface Calls {
  vision: number;
  luna: number;
  llm: number;
}

const analysis = {
  deviceVisible: true,
  detectedDevice: "laptop",
  matchesDeclaredCategory: "YES",
  photoQuality: "SUFFICIENT",
  qualityIssues: [],
  observations: [],
  summary: "Laptop bez widocznych śladów użytkowania.",
  signsOfUse: "NONE_VISIBLE",
  resaleableAsNew: "YES",
  packagingOrAccessoriesVisible: [],
} as ImageAnalysis;

const llmDecision: Decision = {
  decision: "ACCEPT",
  citedClauses: ["R1.1"],
  justification: ["Brak śladów użytkowania."],
  nextSteps: ["Przyjmij zwrot."],
  missingEvidence: [],
  confidence: "HIGH",
  source: "MODEL",
  violationsOnFirstAttempt: [],
};

function makeDeps(opts: {
  mode?: DecisionMode;
  decide?: DecideWithLlm;
  luna?: AssessWithLuna;
} = {}) {
  const calls: Calls = { vision: 0, luna: 0, llm: 0 };
  const clock = fixedClock(NOW);
  const repo = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 50, clock });
  const analyzeImage: AnalyzeImage = async () => {
    calls.vision++;
    return analysis;
  };
  const assessWithLuna: AssessWithLuna =
    opts.luna ??
    (async () => {
      throw new Error("Luna must not be called");
    });
  const decideWithLlm: DecideWithLlm = async (args) => {
    calls.llm++;
    return opts.decide ? opts.decide(args) : llmDecision;
  };
  let n = 0;
  const deps: CaseServiceDeps = {
    repo,
    clock,
    config: {
      appTimezone: "Europe/Warsaw",
      decisionMode: opts.mode ?? "gated",
      lunaConfidenceThreshold: 0.8,
      lunaTimeoutMs: 1000,
      policyDir: path.resolve(__dirname, "../../../../docs/policies"),
    },
    promptVersions: { vision: "vision@1", decision: "decision@1", chat: "chat@1" },
    analyzeImage,
    assessWithLuna: async (a) => {
      calls.luna++;
      return assessWithLuna(a);
    },
    decideWithLlm,
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  };
  return { deps, calls, repo };
}

const photo = (name: string) => new File([new Uint8Array(exampleImage(name))], name, { type: "image/jpeg" });

const expiredReturn = {
  caseType: "RETURN",
  category: "SMARTPHONE",
  model: "Galaxy S24",
  purchaseDate: "2026-10-27", // 30 days before NOW
  reason: "",
};
const freshReturn = { ...expiredReturn, category: "LAPTOP", model: "ThinkPad X1", purchaseDate: "2026-11-20" };

describe("createCaseWithAnalysis", () => {
  it("expired return: RULES path, no analysis, no port calls", async () => {
    const { deps, calls, repo } = makeDeps();
    const res = await createCaseWithAnalysis(deps, expiredReturn, photo("phone-3.jpeg"));
    expect(res.decisionPath).toBe("RULES");
    expect(res.analysis).toBeNull();
    expect(res.assessment).toBeNull();
    expect(res.caseId).toMatch("00000000-0000-4000-8000-000000000001");
    expect(res.caseSummary).toMatchObject({
      caseId: res.caseId,
      caseType: "RETURN",
      caseTypeLabel: "Zwrot",
      category: "SMARTPHONE",
      categoryLabel: "Smartfon",
      model: "Galaxy S24",
      purchaseDate: "2026-10-27",
    });
    expect(calls).toEqual({ vision: 0, luna: 0, llm: 0 });
    const stored = repo.get(res.caseId)!;
    expect(stored.status).toBe("ANALYZED");
    expect(stored.facts).toMatchObject({ daysSincePurchase: 30, withinWindow: false });
    expect(stored.decisionPath).toBe("RULES");
    expect(stored.policyVersion).toMatch(/^[0-9a-f]{12}$/);
    expect(stored.promptVersions).toEqual({ vision: "vision@1", decision: "decision@1", chat: "chat@1" });
    expect(stored.imageMeta.originalByteSize).toBeGreaterThan(0);
    expect(stored).not.toHaveProperty("image");
  });

  it("validation errors return fieldErrors and create no case and no port call", async () => {
    const { deps, calls, repo } = makeDeps();
    const error = await createCaseWithAnalysis(
      deps,
      { ...expiredReturn, category: "TOASTER", model: "x", purchaseDate: "2999-01-01" },
      photo("phone-3.jpeg"),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("VALIDATION_ERROR");
    expect(Object.keys((error as AppError).fieldErrors ?? {}).sort()).toEqual(["category", "model", "purchaseDate"]);
    expect(repo.size()).toBe(0);
    expect(calls).toEqual({ vision: 0, luna: 0, llm: 0 });
  });

  it("a non-image .jpg yields 415, no case and no port call (TAC-001-02)", async () => {
    const { deps, calls, repo } = makeDeps();
    const fake = new File([new TextEncoder().encode("not an image at all")], "evil.jpg", { type: "image/jpeg" });
    const error = await createCaseWithAnalysis(deps, freshReturn, fake).catch((e: unknown) => e);
    expect((error as AppError).status).toBe(415);
    expect(repo.size()).toBe(0);
    expect(calls).toEqual({ vision: 0, luna: 0, llm: 0 });
  });

  it("llm_only: vision runs, analysis DTO is returned, assessment is null", async () => {
    const { deps, calls } = makeDeps({ mode: "llm_only" });
    const res = await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
    expect(res.decisionPath).toBe("LLM");
    expect(res.analysis).toEqual({
      summary: analysis.summary,
      photoQuality: "SUFFICIENT",
      matchesDeclaredCategory: "YES",
    });
    expect(res.assessment).toBeNull();
    expect(calls).toEqual({ vision: 1, luna: 0, llm: 0 });
  });

  it("a vision failure creates no case", async () => {
    const { deps, repo } = makeDeps({ mode: "llm_only" });
    deps.analyzeImage = async () => {
      throw new AiTimeoutError();
    };
    const error = await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png")).catch((e: unknown) => e);
    expect((error as AppError).status).toBe(504);
    expect(repo.size()).toBe(0);
  });

  it("gated: certain Luna answers give FAST with a Polish assessment and no vision call", async () => {
    const lunaFake: AssessWithLuna = async () => {
      const answers = [
        toLunaAnswer("device_matches", { type: "noul", noul: 0.98 }),
        toLunaAnswer("photo_assessable", { type: "noul", noul: 0.97 }),
        toLunaAnswer("signs_of_use", { type: "score", score: 0, probabilities: { "0": 0.95, "1": 0.05 } }),
      ];
      return {
        questionsVersion: "luna-questions@1",
        answers,
        uncertainKeys: [],
        refusedKeys: [],
        latencyMs: 100,
        costUsd: null,
      } satisfies LunaAssessment;
    };
    const { deps, calls, repo } = makeDeps({ luna: lunaFake });
    const res = await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
    expect(res.decisionPath).toBe("FAST");
    expect(res.analysis).toBeNull();
    expect(res.assessment?.items.length).toBe(3);
    expect(res.assessment?.items[0]).toMatchObject({
      key: "device_matches",
      label: "Urządzenie zgodne z deklaracją",
      answerLabel: "tak",
      certain: true,
    });
    expect(res.assessment?.items[0].certaintyPct).toBeGreaterThanOrEqual(80);
    expect(calls).toEqual({ vision: 0, luna: 1, llm: 0 });

    const decided = await decideCase(deps, res.caseId);
    expect(decided.decision.decisionPath).toBe("FAST");
    expect(calls.llm).toBe(0);
    expect(repo.get(res.caseId)?.decision?.source).toBe("FAST");
  });

  it("logs ids and lengths only, never reason text", async () => {
    const logs = captureLogs();
    try {
      const { deps } = makeDeps();
      await createCaseWithAnalysis(deps, { ...expiredReturn, reason: "SEKRETNY-POWOD-KLIENTA" }, photo("phone-3.jpeg"));
      expect(logs.text()).not.toContain("SEKRETNY-POWOD-KLIENTA");
    } finally {
      logs.restore();
    }
  });
});

describe("decideCase", () => {
  it("RULES path: REJECT citing R1.3 with a rendered first message, zero port calls", async () => {
    const { deps, calls, repo } = makeDeps();
    const created = await createCaseWithAnalysis(deps, expiredReturn, photo("phone-3.jpeg"));
    const res = await decideCase(deps, created.caseId);
    expect(res.decision).toMatchObject({
      value: "REJECT",
      label: "Zwrot odrzucony",
      tone: "negative",
      daysSincePurchase: 30,
      decisionPath: "RULES",
    });
    expect(res.decision.citedClauses).toContain("R1.3");
    const text = res.firstMessage.parts[0].text;
    expect(res.firstMessage.role).toBe("assistant");
    expect(text).toContain("Uzasadnienie");
    expect(text).toContain("Kolejne kroki");
    expect(text).toContain("Ostateczną decyzję podejmuje pracownik");
    expect(calls).toEqual({ vision: 0, luna: 0, llm: 0 });

    const stored = repo.get(created.caseId)!;
    expect(stored.status).toBe("DECIDED");
    expect(stored.decisionHistory).toHaveLength(1);
    expect(stored.decisionHistory[0]).toMatchObject({ trigger: "INITIAL" });
    expect(stored.messages).toHaveLength(1);
    expect(stored.messages[0].id).toBe(res.firstMessage.id);
  });

  it("is idempotent: a second call returns the same body and makes no calls", async () => {
    const { deps, calls, repo } = makeDeps({ mode: "llm_only" });
    const created = await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
    const first = await decideCase(deps, created.caseId);
    expect(calls.llm).toBe(1);
    const second = await decideCase(deps, created.caseId);
    expect(second).toEqual(first);
    expect(calls).toEqual({ vision: 1, luna: 0, llm: 1 });
    expect(repo.get(created.caseId)?.decisionHistory).toHaveLength(1);
  });

  it("unknown id gives 404 and malformed id gives 400", async () => {
    const { deps } = makeDeps();
    const unknown = await decideCase(deps, "11111111-1111-4111-8111-111111111111").catch((e: unknown) => e);
    expect((unknown as AppError).code).toBe("CASE_NOT_FOUND");
    expect((unknown as AppError).status).toBe(404);
    const bad = await decideCase(deps, "not-a-uuid").catch((e: unknown) => e);
    expect((bad as AppError).code).toBe("VALIDATION_ERROR");
    expect((bad as AppError).status).toBe(400);
  });

  it("LLM path: a timeout gives 504 and the case stays ANALYZED; a retry succeeds", async () => {
    let attempt = 0;
    const { deps, repo } = makeDeps({
      mode: "llm_only",
      decide: async () => {
        if (++attempt === 1) throw new AiTimeoutError();
        return llmDecision;
      },
    });
    const created = await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
    const error = await decideCase(deps, created.caseId).catch((e: unknown) => e);
    expect((error as AppError).status).toBe(504);
    const afterFailure = repo.get(created.caseId)!;
    expect(afterFailure.status).toBe("ANALYZED");
    expect(afterFailure.decision).toBeNull();
    expect(afterFailure.messages).toHaveLength(0);

    const res = await decideCase(deps, created.caseId);
    expect(res.decision).toMatchObject({ value: "ACCEPT", decisionPath: "LLM" });
    expect(repo.get(created.caseId)?.status).toBe("DECIDED");
  });

  it("shadow mode stores the comparison on the case", async () => {
    const { deps, repo } = makeDeps({ mode: "shadow" });
    deps.assessWithLuna = async () => {
      throw new Error("down");
    };
    const created = await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
    expect(created.decisionPath).toBe("LLM");
    expect(created.assessment).toBeNull();
    await decideCase(deps, created.caseId);
    expect(repo.get(created.caseId)?.shadow).toEqual({ fastDecision: "UNCERTAIN", agreesWithLlm: null });
  });
  describe("shadow logging (ADR 004 §3.1: stored and logged)", () => {
    const certainLuna: AssessWithLuna = async () => ({
      questionsVersion: "luna-questions@1",
      answers: [
        toLunaAnswer("device_matches", { type: "noul", noul: 0.98 }),
        toLunaAnswer("photo_assessable", { type: "noul", noul: 0.97 }),
        toLunaAnswer("signs_of_use", { type: "score", score: 0, probabilities: { "0": 0.95, "1": 0.05 } }),
      ],
      uncertainKeys: [],
      refusedKeys: [],
      latencyMs: 123,
      costUsd: 0.0002,
    });
    const events = (logs: ReturnType<typeof captureLogs>, event: string) =>
      logs.lines.map((l) => JSON.parse(l) as Record<string, unknown>).filter((l) => l.event === event);

    it("createCaseWithAnalysis logs luna_shadow with the fast result, uncertainKeys, latency and cost", async () => {
      const logs = captureLogs();
      try {
        const { deps } = makeDeps({ mode: "shadow", luna: certainLuna });
        await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
        const [line, ...rest] = events(logs, "luna_shadow");
        expect(rest).toHaveLength(0);
        expect(line).toMatchObject({
          shadowFast: "ACCEPT",
          uncertainKeys: [],
          latencyMs: 123,
          costUsd: 0.0002,
        });
        expect(line.caseId).toEqual(expect.any(String));
      } finally {
        logs.restore();
      }
    });

    it("does not log luna_shadow when Luna is unavailable", async () => {
      const logs = captureLogs();
      try {
        const { deps } = makeDeps({ mode: "shadow", luna: async () => { throw new Error("down"); } });
        await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
        expect(events(logs, "luna_shadow")).toHaveLength(0);
      } finally {
        logs.restore();
      }
    });

    it("decideCase adds shadowFast and agreesWithLlm to case_decided", async () => {
      const logs = captureLogs();
      try {
        const { deps } = makeDeps({ mode: "shadow", luna: certainLuna });
        const created = await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
        await decideCase(deps, created.caseId);
        const [line] = events(logs, "case_decided");
        expect(line).toMatchObject({ shadowFast: "ACCEPT", agreesWithLlm: true });
      } finally {
        logs.restore();
      }
    });

    it("case_decided carries no shadow fields outside shadow mode", async () => {
      const logs = captureLogs();
      try {
        const { deps } = makeDeps({ mode: "llm_only" });
        const created = await createCaseWithAnalysis(deps, freshReturn, photo("laptop-1.png"));
        await decideCase(deps, created.caseId);
        const [line] = events(logs, "case_decided");
        expect(line).not.toHaveProperty("shadowFast");
        expect(line).not.toHaveProperty("agreesWithLlm");
      } finally {
        logs.restore();
      }
    });
  });
});

