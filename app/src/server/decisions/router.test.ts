// Router tests (ADR 004 TAC-004-02/-03/-04). Dependencies are typed fakes of our own ports with
// call counters; LunaAssessment values are built with toLunaAnswer from raw answers of the
// documented shapes (pure function inputs, not network mocks).
import { describe, expect, it } from "vitest";
import type { CaseInput } from "@/lib/shared/case-input";
import type { DecisionMode } from "@/lib/shared/enums";
import { expiredWindowDecision } from "@/server/ai/guardrails";
import type {
  AnalyzeImage,
  AssessWithLuna,
  Case,
  DecideWithLlm,
  Decision,
  DecisionFacts,
  ImageAnalysis,
  LunaAnswer,
  LunaAssessment,
  ProcessedImage,
} from "@/server/domain";
import { captureLogs } from "../../../tests/helpers/log-capture";
import { assess, toLunaAnswer } from "./certainty";
import { routeAnalysis, routeDecision, type RouterDeps } from "./router";

const THRESHOLD = 0.8;

const returnInput: CaseInput = {
  caseType: "RETURN",
  category: "LAPTOP",
  model: "ThinkPad X1",
  purchaseDate: "2026-11-20",
  reason: "",
};
const complaintInput: CaseInput = {
  caseType: "COMPLAINT",
  category: "SMARTPHONE",
  model: "Galaxy S24",
  purchaseDate: "2026-11-20",
  reason: "Ekran pęknięty od pierwszego dnia użytkowania",
};

const image = { bytes: Buffer.from([1, 2, 3]), format: "jpeg", width: 10, height: 10, byteSize: 3 } as ProcessedImage;
const analysis = { summary: "fake analysis" } as unknown as ImageAnalysis;

const facts = (over: Partial<DecisionFacts> = {}): DecisionFacts => ({
  submissionDate: "2026-11-25",
  daysSincePurchase: 5,
  windowDays: 14,
  withinWindow: true,
  deadOnArrivalWindow: false,
  ...over,
});
const expiredReturn = facts({ daysSincePurchase: 15, withinWindow: false });
const expiredComplaint = facts({ daysSincePurchase: 731, windowDays: 730, withinWindow: false });
const complaintFacts = facts({ windowDays: 730, deadOnArrivalWindow: true });

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

type Raw = Record<string, unknown>;
const noul = (p: number, confidence?: number): Raw => ({ type: "noul", noul: p, ...(confidence ? { confidence } : {}) });
const choice = (c: string, p: number): Raw => ({
  type: "choice",
  choice: c,
  probabilities: { [c]: p, other: 1 - p },
});
const score = (level: number, p: number): Raw => ({
  type: "score",
  score: level,
  probabilities: { [String(level)]: p, [String(level === 0 ? 1 : 0)]: 1 - p },
});

function luna(raw: Record<string, Raw>, threshold = THRESHOLD): LunaAssessment {
  const answers: LunaAnswer[] = Object.entries(raw).map(([k, v]) => toLunaAnswer(k, v));
  const a = assess(answers, threshold);
  return {
    questionsVersion: "luna-questions@1",
    answers,
    uncertainKeys: a.uncertainKeys,
    refusedKeys: a.refusedKeys,
    latencyMs: 200,
    costUsd: 0.0001,
  };
}

const returnAnswers = (over: Record<string, Raw> = {}) => ({
  device_matches: noul(0.97),
  photo_assessable: noul(0.95),
  signs_of_use: score(0, 0.9),
  ...over,
});
const complaintAnswers = (over: Record<string, Raw> = {}) => ({
  device_matches: noul(0.97),
  photo_assessable: noul(0.95),
  defect_visibility: choice("visible", 0.9),
  damage_cause: choice("manufacturing_defect", 0.88),
  ...over,
});

interface Counters {
  vision: number;
  luna: number;
  llm: number;
  llmArgs: Parameters<DecideWithLlm>[0][];
}

function makeDeps(
  mode: DecisionMode,
  opts: { luna?: () => Promise<LunaAssessment>; vision?: () => Promise<ImageAnalysis>; lunaTimeoutMs?: number } = {},
): { deps: RouterDeps; n: Counters } {
  const n: Counters = { vision: 0, luna: 0, llm: 0, llmArgs: [] };
  const analyzeImage: AnalyzeImage = async () => {
    n.vision++;
    return opts.vision ? opts.vision() : analysis;
  };
  const assessWithLuna: AssessWithLuna = async () => {
    n.luna++;
    if (!opts.luna) throw new Error("luna not configured");
    return opts.luna();
  };
  const decideWithLlm: DecideWithLlm = async (args) => {
    n.llm++;
    n.llmArgs.push(args);
    return llmDecision;
  };
  return {
    deps: { mode, threshold: THRESHOLD, lunaTimeoutMs: opts.lunaTimeoutMs ?? 5000, analyzeImage, assessWithLuna, decideWithLlm },
    n,
  };
}

const step1 = (deps: RouterDeps, input: CaseInput, f: DecisionFacts) =>
  routeAnalysis(deps, { caseId: "c1", input, image, facts: f });

/** Builds the stored case the way the service would after step 1. */
function storedCase(
  deps: RouterDeps,
  input: CaseInput,
  f: DecisionFacts,
  r: Awaited<ReturnType<typeof routeAnalysis>>,
): Case & { preparedDecision: Decision | null } {
  return {
    id: "c1",
    input,
    facts: f,
    analysis: r.analysis,
    decisionPath: r.decisionPath,
    lunaAssessment: r.lunaAssessment,
    shadow: r.shadowFast ? { fastDecision: r.shadowFast, agreesWithLlm: null } : null,
    preparedDecision: r.preparedDecision,
    decision: null,
  } as unknown as Case & { preparedDecision: Decision | null };
}

const MODES: DecisionMode[] = ["llm_only", "shadow", "gated"];

describe("expired window: RULES, zero dependency calls, every mode (TAC-004-03)", () => {
  for (const mode of MODES) {
    for (const [name, input, f] of [
      ["return 15 days", returnInput, expiredReturn],
      ["complaint 731 days", complaintInput, expiredComplaint],
    ] as const) {
      it(`${mode} / ${name}`, async () => {
        const { deps, n } = makeDeps(mode, { luna: async () => luna(returnAnswers()) });
        const r = await step1(deps, input, f);
        const expected = expiredWindowDecision(input.caseType, f, "RULES");
        expect(r.decisionPath).toBe("RULES");
        expect(r.analysis).toBeNull();
        expect(r.lunaAssessment).toBeNull();
        expect(r.shadowFast).toBeNull();
        expect(r.preparedDecision).toEqual(expected);
        const r2 = await routeDecision(deps, storedCase(deps, input, f, r));
        expect(r2.decision).toEqual(expected);
        expect(r2.decision.source).toBe("RULES");
        expect(r2.shadow).toBeNull();
        // step 2 also works without a prepared decision
        const r3 = await routeDecision(deps, { ...storedCase(deps, input, f, r), preparedDecision: null });
        expect(r3.decision).toEqual(expected);
        expect(n).toMatchObject({ vision: 0, luna: 0, llm: 0 });
      });
    }
  }
});

describe("llm_only", () => {
  it("step 1 calls only the vision model; step 2 calls the LLM without preliminary", async () => {
    const { deps, n } = makeDeps("llm_only", { luna: async () => luna(returnAnswers()) });
    const r = await step1(deps, returnInput, facts());
    expect(r).toMatchObject({ decisionPath: "LLM", analysis, lunaAssessment: null, preparedDecision: null, shadowFast: null });
    expect(n).toMatchObject({ vision: 1, luna: 0, llm: 0 });
    const r2 = await routeDecision(deps, storedCase(deps, returnInput, facts(), r));
    expect(r2).toEqual({ decision: llmDecision, shadow: null });
    expect(n).toMatchObject({ vision: 1, luna: 0, llm: 1 });
    expect(n.llmArgs[0]).not.toHaveProperty("preliminary");
    expect(n.llmArgs[0]).toMatchObject({ input: returnInput, analysis, facts: facts() });
  });

  it("vision errors propagate", async () => {
    const { deps } = makeDeps("llm_only", { vision: async () => Promise.reject(new Error("vision down")) });
    await expect(step1(deps, returnInput, facts())).rejects.toThrow("vision down");
  });
});

describe("shadow", () => {
  it("runs vision and Luna concurrently", async () => {
    const order: string[] = [];
    let releaseLuna!: () => void;
    const { deps } = makeDeps("shadow", {
      vision: async () => {
        order.push("vision-start");
        return analysis;
      },
      luna: () =>
        new Promise<LunaAssessment>((resolve) => {
          order.push("luna-start");
          releaseLuna = () => resolve(luna(returnAnswers()));
        }),
    });
    const p = step1(deps, returnInput, facts());
    await new Promise((r) => setTimeout(r, 0));
    expect(order.sort()).toEqual(["luna-start", "vision-start"]);
    releaseLuna();
    await p;
  });

  it("success: LLM decides without preliminary; shadow compares fast result with LLM", async () => {
    const { deps, n } = makeDeps("shadow", { luna: async () => luna(returnAnswers({ signs_of_use: score(3, 0.9) })) });
    const r = await step1(deps, returnInput, facts());
    expect(r.decisionPath).toBe("LLM");
    expect(r.analysis).toBe(analysis);
    expect(r.lunaAssessment).not.toBeNull();
    expect(r.shadowFast).toBe("REJECT");
    expect(r.preparedDecision).toBeNull();
    const r2 = await routeDecision(deps, storedCase(deps, returnInput, facts(), r));
    expect(r2.decision).toEqual(llmDecision);
    expect(r2.shadow).toEqual({ fastDecision: "REJECT", agreesWithLlm: true });
    expect(n.llmArgs[0]).not.toHaveProperty("preliminary");
  });

  it("disagreement is reported", async () => {
    const { deps } = makeDeps("shadow", { luna: async () => luna(returnAnswers()) }); // ACCEPT vs LLM REJECT
    const r = await step1(deps, returnInput, facts());
    expect(r.shadowFast).toBe("ACCEPT");
    const r2 = await routeDecision(deps, storedCase(deps, returnInput, facts(), r));
    expect(r2.shadow).toEqual({ fastDecision: "ACCEPT", agreesWithLlm: false });
  });

  it("agreesWithLlm is null when the fast result is not a decision", async () => {
    const cases: [string, CaseInput, DecisionFacts, () => Promise<LunaAssessment>][] = [
      ["UNCERTAIN", returnInput, facts(), async () => luna(returnAnswers({ signs_of_use: score(0, 0.62) }))],
      [
        "UNMAPPED",
        complaintInput,
        complaintFacts,
        async () => luna(complaintAnswers({ damage_cause: choice("no_visible_damage", 0.9) })),
      ],
      ["NOT_ELIGIBLE", { ...returnInput, category: "OTHER" }, facts(), async () => luna(returnAnswers())],
      ["NOT_ELIGIBLE", { ...returnInput, category: "AUDIO" }, facts(), async () => luna(returnAnswers())],
    ];
    for (const [expected, input, f, lunaFn] of cases) {
      const { deps } = makeDeps("shadow", { luna: lunaFn });
      const r = await step1(deps, input, f);
      expect(r.shadowFast).toBe(expected);
      const r2 = await routeDecision(deps, storedCase(deps, input, f, r));
      expect(r2.shadow).toEqual({ fastDecision: expected, agreesWithLlm: null });
      expect(r2.decision).toEqual(llmDecision);
    }
  });

  it("a refusal makes the shadow result UNCERTAIN", async () => {
    const { deps } = makeDeps("shadow", {
      luna: async () => luna(returnAnswers({ photo_assessable: { type: "refusal" } })),
    });
    const r = await step1(deps, returnInput, facts());
    expect(r.shadowFast).toBe("UNCERTAIN");
  });

  it("Luna rejection and timeout never change the outcome (TAC-004-04)", async () => {
    const logs = captureLogs();
    try {
      const failing = [
        makeDeps("shadow", { luna: async () => Promise.reject(new Error("luna 500")) }),
        makeDeps("shadow", { luna: () => new Promise<LunaAssessment>(() => {}), lunaTimeoutMs: 20 }),
      ];
      for (const { deps, n } of failing) {
        const r = await step1(deps, returnInput, facts());
        expect(r).toEqual({
          decisionPath: "LLM",
          analysis,
          lunaAssessment: null,
          preparedDecision: null,
          shadowFast: "UNCERTAIN",
        });
        const r2 = await routeDecision(deps, storedCase(deps, returnInput, facts(), r));
        expect(r2.decision).toEqual(llmDecision);
        expect(r2.shadow).toEqual({ fastDecision: "UNCERTAIN", agreesWithLlm: null });
        expect(n.llmArgs[0]).not.toHaveProperty("preliminary");
      }
      expect(logs.text()).toContain("luna");
    } finally {
      logs.restore();
    }
  });

  it("vision errors still propagate even if Luna succeeds", async () => {
    const { deps } = makeDeps("shadow", {
      vision: async () => Promise.reject(new Error("vision down")),
      luna: async () => luna(returnAnswers()),
    });
    await expect(step1(deps, returnInput, facts())).rejects.toThrow("vision down");
  });
});

describe("gated: FAST", () => {
  it("return: all certain and mapped -> FAST, no vision, no LLM", async () => {
    const { deps, n } = makeDeps("gated", { luna: async () => luna(returnAnswers()) });
    const r = await step1(deps, returnInput, facts());
    expect(r.decisionPath).toBe("FAST");
    expect(r.analysis).toBeNull();
    expect(r.lunaAssessment?.answers).toHaveLength(3);
    expect(r.shadowFast).toBeNull();
    expect(r.preparedDecision).toMatchObject({ decision: "ACCEPT", source: "FAST" });
    const r2 = await routeDecision(deps, storedCase(deps, returnInput, facts(), r));
    expect(r2.decision).toEqual(r.preparedDecision);
    expect(r2.shadow).toBeNull();
    expect(n).toMatchObject({ vision: 0, luna: 1, llm: 0 });
  });

  it("complaint: DOA manufacturing defect -> FAST REPLACE", async () => {
    const { deps, n } = makeDeps("gated", { luna: async () => luna(complaintAnswers()) });
    const r = await step1(deps, complaintInput, complaintFacts);
    expect(r.decisionPath).toBe("FAST");
    expect(r.preparedDecision).toMatchObject({ decision: "REPLACE", source: "FAST" });
    expect(n).toMatchObject({ vision: 0, llm: 0 });
  });

  it("certainty exactly at the threshold is certain", async () => {
    const { deps } = makeDeps("gated", {
      luna: async () => luna(returnAnswers({ signs_of_use: score(0, 0.8) })),
    });
    expect((await step1(deps, returnInput, facts())).decisionPath).toBe("FAST");
  });

  it("step 2 rebuilds the decision from the stored assessment when none was prepared", async () => {
    const { deps, n } = makeDeps("gated", { luna: async () => luna(returnAnswers()) });
    const r = await step1(deps, returnInput, facts());
    const r2 = await routeDecision(deps, { ...storedCase(deps, returnInput, facts(), r), preparedDecision: null });
    expect(r2.decision).toMatchObject({ decision: "ACCEPT", source: "FAST" });
    expect(n.llm).toBe(0);
  });

  it("step 2 refuses to produce FAST from an unsafe stored assessment (fail closed)", async () => {
    const { deps, n } = makeDeps("gated");
    const unsafe = luna(returnAnswers({ signs_of_use: score(0, 0.6) }));
    const c = {
      ...storedCase(deps, returnInput, facts(), {
        decisionPath: "FAST",
        analysis: null,
        lunaAssessment: unsafe,
        preparedDecision: null,
        shadowFast: null,
      }),
    };
    await expect(routeDecision(deps, c)).rejects.toThrow();
    expect(n.llm).toBe(0);
  });

  it("step 2 on FAST without any assessment throws", async () => {
    const { deps } = makeDeps("gated");
    const c = storedCase(deps, returnInput, facts(), {
      decisionPath: "FAST",
      analysis: null,
      lunaAssessment: null,
      preparedDecision: null,
      shadowFast: null,
    });
    await expect(routeDecision(deps, c)).rejects.toThrow();
  });
});

describe("gated: LLM_ESCALATED never FAST (TAC-004-02)", () => {
  async function escalates(name: string, input: CaseInput, f: DecisionFacts, a: LunaAssessment, keys: string[]) {
    const { deps, n } = makeDeps("gated", { luna: async () => a });
    const r = await step1(deps, input, f);
    expect(r.decisionPath, name).toBe("LLM_ESCALATED");
    expect(r.analysis).toBe(analysis);
    expect(r.preparedDecision).toBeNull();
    expect(r.shadowFast).toBeNull();
    expect(r.lunaAssessment?.uncertainKeys).toEqual(keys);
    expect(n).toMatchObject({ vision: 1, luna: 1, llm: 0 });
    const r2 = await routeDecision(deps, storedCase(deps, input, f, r));
    expect(r2.decision).toEqual(llmDecision);
    expect(r2.shadow).toBeNull();
    expect(n.llm).toBe(1);
    expect(n.llmArgs[0].preliminary).toEqual(r.lunaAssessment);
  }

  it("certainty 0.62 on damage_cause", async () => {
    await escalates(
      "0.62",
      complaintInput,
      complaintFacts,
      luna(complaintAnswers({ damage_cause: choice("manufacturing_defect", 0.62) })),
      ["damage_cause"],
    );
  });

  it("just below the threshold escalates", async () => {
    await escalates("0.7999", returnInput, facts(), luna(returnAnswers({ signs_of_use: score(0, 0.7999) })), ["signs_of_use"]);
  });

  it("refusal escalates and is kept in refusedKeys", async () => {
    const a = luna(returnAnswers({ photo_assessable: { type: "refusal" } }));
    await escalates("refusal", returnInput, facts(), a, ["photo_assessable"]);
  });

  it("missing answer escalates", async () => {
    const a = luna(returnAnswers({ signs_of_use: { type: "weird" } }));
    await escalates("missing", returnInput, facts(), a, ["signs_of_use"]);
  });

  it("empty answers escalate", async () => {
    await escalates("empty", returnInput, facts(), luna({}), []);
  });

  it("UNMAPPED combination escalates", async () => {
    await escalates(
      "unmapped",
      complaintInput,
      complaintFacts,
      luna(complaintAnswers({ damage_cause: choice("no_visible_damage", 0.9) })),
      [],
    );
  });

  it("uncertain keys are recomputed with the router threshold", async () => {
    // client assessed at 0.5 (nothing uncertain), router threshold is 0.8
    const a = luna(returnAnswers({ signs_of_use: score(0, 0.6) }), 0.5);
    expect(a.uncertainKeys).toEqual([]);
    await escalates("recompute", returnInput, facts(), a, ["signs_of_use"]);
  });

  it("Luna error escalates without a preliminary assessment", async () => {
    const { deps, n } = makeDeps("gated", { luna: async () => Promise.reject(new Error("HTTP 500")) });
    const logs = captureLogs();
    try {
      const r = await step1(deps, returnInput, facts());
      expect(r).toMatchObject({ decisionPath: "LLM_ESCALATED", analysis, lunaAssessment: null, preparedDecision: null });
      expect(n).toMatchObject({ vision: 1, luna: 1 });
      const r2 = await routeDecision(deps, storedCase(deps, returnInput, facts(), r));
      expect(r2.decision).toEqual(llmDecision);
      expect(n.llmArgs[0]).not.toHaveProperty("preliminary");
    } finally {
      logs.restore();
    }
  });

  it("Luna timeout escalates", async () => {
    const { deps, n } = makeDeps("gated", { luna: () => new Promise<LunaAssessment>(() => {}), lunaTimeoutMs: 20 });
    const logs = captureLogs();
    try {
      const r = await step1(deps, returnInput, facts());
      expect(r).toMatchObject({ decisionPath: "LLM_ESCALATED", lunaAssessment: null });
      expect(n).toMatchObject({ vision: 1, luna: 1, llm: 0 });
    } finally {
      logs.restore();
    }
  });

  it("the Luna call receives an abort signal that fires on timeout", async () => {
    let signal: AbortSignal | undefined;
    const { deps } = makeDeps("gated", { lunaTimeoutMs: 20 });
    deps.assessWithLuna = (args) => {
      signal = args.signal;
      return new Promise<LunaAssessment>(() => {});
    };
    const logs = captureLogs();
    try {
      await step1(deps, returnInput, facts());
    } finally {
      logs.restore();
    }
    expect(signal?.aborted).toBe(true);
  });

  it("vision errors propagate in gated escalation", async () => {
    const { deps } = makeDeps("gated", {
      luna: async () => luna(returnAnswers({ signs_of_use: score(0, 0.5) })),
      vision: async () => Promise.reject(new Error("vision down")),
    });
    await expect(step1(deps, returnInput, facts())).rejects.toThrow("vision down");
  });
});

describe("gated: ineligible cases skip Luna", () => {
  for (const [name, input] of [
    ["category OTHER", { ...returnInput, category: "OTHER" } as CaseInput],
    ["return AUDIO", { ...returnInput, category: "AUDIO" } as CaseInput],
  ] as const) {
    it(name, async () => {
      const { deps, n } = makeDeps("gated", { luna: async () => luna(returnAnswers()) });
      const r = await step1(deps, input, facts());
      expect(r).toMatchObject({ decisionPath: "LLM_ESCALATED", analysis, lunaAssessment: null, preparedDecision: null });
      expect(n).toMatchObject({ vision: 1, luna: 0 });
      const r2 = await routeDecision(deps, storedCase(deps, input, facts(), r));
      expect(r2.decision).toEqual(llmDecision);
      expect(n.llmArgs[0]).not.toHaveProperty("preliminary");
    });
  }
});

describe("step 2 invariants", () => {
  it("an LLM path without a stored analysis throws", async () => {
    const { deps } = makeDeps("llm_only");
    const c = storedCase(deps, returnInput, facts(), {
      decisionPath: "LLM",
      analysis: null,
      lunaAssessment: null,
      preparedDecision: null,
      shadowFast: null,
    });
    await expect(routeDecision(deps, c)).rejects.toThrow();
  });

  it("shadow step 2 without a stored shadow result reports UNCERTAIN", async () => {
    const { deps } = makeDeps("shadow");
    const c = storedCase(deps, returnInput, facts(), {
      decisionPath: "LLM",
      analysis,
      lunaAssessment: null,
      preparedDecision: null,
      shadowFast: null,
    });
    const r = await routeDecision(deps, c);
    expect(r.shadow).toEqual({ fastDecision: "UNCERTAIN", agreesWithLlm: null });
  });
});
