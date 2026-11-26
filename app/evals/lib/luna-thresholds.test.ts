import { describe, expect, it } from "vitest";
import type { DecisionFacts, LunaAnswer } from "@/server/domain";
import { evaluateThresholds, LUNA_THRESHOLDS, type LunaEvalRun } from "./luna-thresholds";

const facts: DecisionFacts = { submissionDate: "2026-11-26", daysSincePurchase: 5, windowDays: 14, withinWindow: true, deadOnArrivalWindow: false };
const noul = (key: string, value: boolean, certainty: number): LunaAnswer => ({ key, type: "noul", value, certainty });
const score = (level: number, certainty: number): LunaAnswer => ({ key: "signs_of_use", type: "score", value: level, certainty });
const returnAnswers = (level: number, certainty: number): LunaAnswer[] => [
  noul("device_matches", true, certainty),
  noul("photo_assessable", true, certainty),
  score(level, certainty),
];
const run = (over: Partial<LunaEvalRun>): LunaEvalRun => ({
  caseId: "c",
  answers: returnAnswers(0, 0.97),
  eligible: true,
  facts,
  caseType: "RETURN",
  referenceDecision: "ACCEPT",
  ...over,
});
const row = (r: ReturnType<typeof evaluateThresholds>, t: number) => r.rows.find((x) => x.threshold === t)!;

describe("evaluateThresholds", () => {
  it("uses the five thresholds from ADR 004 section 6", () => {
    expect(LUNA_THRESHOLDS).toEqual([0.6, 0.7, 0.8, 0.9, 0.95]);
  });

  it("computes coverage as the share of FAST runs and respects the threshold", () => {
    const runs = [run({ caseId: "1" }), run({ caseId: "2", answers: returnAnswers(0, 0.85) }), run({ caseId: "3", answers: returnAnswers(0, 0.65) }), run({ caseId: "4", eligible: false })];
    const r = evaluateThresholds(runs);
    expect(row(r, 0.6).fast).toBe(3);
    expect(row(r, 0.6).coverage).toBe(0.75);
    expect(row(r, 0.8).fast).toBe(2);
    expect(row(r, 0.9).fast).toBe(1);
    expect(row(r, 0.95).fast).toBe(1);
  });

  it("measures agreement on FAST cases only", () => {
    const runs = [run({}), run({ referenceDecision: "REJECT", answers: returnAnswers(3, 0.97) }), run({ referenceDecision: "NEEDS_MANUAL_REVIEW" }), run({ eligible: false, referenceDecision: "ACCEPT" })];
    const r = row(evaluateThresholds(runs), 0.8);
    // FAST: ACCEPT=ACCEPT (agree), REJECT=REJECT (agree), ACCEPT vs NMR (disagree, unsafe)
    expect(r.fast).toBe(3);
    expect(r.agreeing).toBe(2);
    expect(r.agreement).toBeCloseTo(2 / 3);
    expect(r.unsafe).toBe(1);
  });

  it("counts only ACCEPT/REPAIR/REPLACE vs REJECT/NMR as unsafe", () => {
    const complaint = (dc: string, ref: LunaEvalRun["referenceDecision"]) =>
      run({
        caseType: "COMPLAINT",
        referenceDecision: ref,
        answers: [
          noul("device_matches", true, 0.99),
          noul("photo_assessable", true, 0.99),
          { key: "defect_visibility", type: "choice", value: "visible", certainty: 0.99 },
          { key: "damage_cause", type: "choice", value: dc, certainty: 0.99 },
        ],
      });
    const r = row(evaluateThresholds([complaint("manufacturing_defect", "REJECT"), complaint("manufacturing_defect", "REPAIR"), complaint("impact", "ACCEPT" as never), complaint("normal_wear", "NEEDS_MANUAL_REVIEW")]), 0.8);
    // REPAIR vs REJECT = unsafe; REPAIR vs REPAIR ok; REJECT vs ACCEPT not unsafe; REJECT vs NMR not unsafe
    expect(r.fast).toBe(4);
    expect(r.unsafe).toBe(1);
  });

  it("excludes UNMAPPED combinations from FAST", () => {
    const unmapped = run({
      caseType: "COMPLAINT",
      answers: [
        noul("device_matches", true, 0.99),
        noul("photo_assessable", true, 0.99),
        { key: "defect_visibility", type: "choice", value: "visible", certainty: 0.99 },
        { key: "damage_cause", type: "choice", value: "no_visible_damage", certainty: 0.99 },
      ],
    });
    expect(row(evaluateThresholds([unmapped]), 0.6).fast).toBe(0);
  });

  it("has null agreement when nothing is FAST and recommends staying in shadow", () => {
    const r = evaluateThresholds([run({ eligible: false })]);
    expect(row(r, 0.8).agreement).toBeNull();
    expect(r.recommendation).toEqual({ kind: "STAY_IN_SHADOW", reason: expect.any(String) });
  });

  it("recommends the lowest threshold meeting agreement, safety and coverage", () => {
    // 10 runs: 4 with certainty 0.92 (all agree), 6 with certainty 0.65 (would disagree if FAST).
    const sure = Array.from({ length: 4 }, (_, i) => run({ caseId: `s${i}`, answers: returnAnswers(0, 0.92) }));
    const shaky = Array.from({ length: 6 }, (_, i) => run({ caseId: `x${i}`, answers: returnAnswers(0, 0.65), referenceDecision: "REJECT" }));
    const r = evaluateThresholds([...sure, ...shaky]);
    expect(row(r, 0.6).meetsCriteria).toBe(false);
    expect(row(r, 0.7).meetsCriteria).toBe(true);
    expect(row(r, 0.7).coverage).toBeCloseTo(0.4);
    expect(r.recommendation).toEqual({ kind: "SWITCH", threshold: 0.7 });
  });

  it("does not recommend when coverage is below 30%", () => {
    const r = evaluateThresholds([run({}), ...Array.from({ length: 9 }, () => run({ eligible: false }))]);
    expect(row(r, 0.8).coverage).toBeCloseTo(0.1);
    expect(r.recommendation.kind).toBe("STAY_IN_SHADOW");
  });

  it("does not recommend with any unsafe disagreement even at 100% coverage and 95%+ agreement", () => {
    const agree = Array.from({ length: 30 }, () => run({}));
    const r = evaluateThresholds([...agree, run({ referenceDecision: "REJECT" })]);
    expect(row(r, 0.8).agreement).toBeGreaterThanOrEqual(0.95);
    expect(row(r, 0.8).unsafe).toBe(1);
    expect(r.recommendation.kind).toBe("STAY_IN_SHADOW");
  });

  it("reports Luna and LLM latency percentiles and mean cost per case", () => {
    const runs = [100, 200, 300, 400].map((ms, i) => run({ caseId: `${i}`, lunaLatencyMs: ms, lunaCostUsd: 0.001 * (i + 1), llmLatencyMs: ms * 10, llmCostUsd: i === 0 ? null : 0.01 }));
    const r = evaluateThresholds(runs);
    expect(r.luna.latencyMs).toEqual({ p50: 200, p95: 400 });
    expect(r.luna.meanCostUsd).toBeCloseTo(0.0025);
    expect(r.llm.latencyMs).toEqual({ p50: 2000, p95: 4000 });
    expect(r.llm.meanCostUsd).toBeCloseTo(0.01);
    expect(r.llm.unknownCost).toBe(1);
  });

  it("returns empty stats when no latency was recorded", () => {
    const r = evaluateThresholds([run({})]);
    expect(r.luna.latencyMs).toBeNull();
    expect(r.luna.meanCostUsd).toBeNull();
  });
});
