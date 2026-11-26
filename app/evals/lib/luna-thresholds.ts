// Luna fast-path evaluation per confidence threshold (ADR 004 section 6). Pure: takes the answers
// recorded for each run and replays the production certainty check and mapping at each threshold.
import type { CaseType } from "@/lib/shared";
import { assess } from "@/server/decisions/certainty";
import { mapToDecision } from "@/server/decisions/fast-path";
import type { DecisionFacts, DecisionValue, LunaAnswer } from "@/server/domain";
import { callStats, type CallStats } from "./stats";

export const LUNA_THRESHOLDS = [0.6, 0.7, 0.8, 0.9, 0.95] as const;
/** Exit criteria for switching DECISION_MODE to `gated` (ADR 004 section 6 item 4). */
export const EXIT_CRITERIA = { minAgreement: 0.95, maxUnsafe: 0, minCoverage: 0.3 } as const;

export interface LunaEvalRun {
  caseId: string;
  answers: LunaAnswer[];
  /** Fast-path eligibility (ADR 004 section 4.3). */
  eligible: boolean;
  facts: DecisionFacts;
  caseType: CaseType;
  /** Decision of the independent LLM pipeline. */
  referenceDecision: DecisionValue;
  lunaLatencyMs?: number;
  lunaCostUsd?: number | null;
  llmLatencyMs?: number;
  llmCostUsd?: number | null;
}

export interface ThresholdRow {
  threshold: number;
  runs: number;
  fast: number;
  coverage: number;
  agreeing: number;
  /** Null when no run took FAST. */
  agreement: number | null;
  unsafe: number;
  meetsCriteria: boolean;
}

export type Recommendation = { kind: "SWITCH"; threshold: number } | { kind: "STAY_IN_SHADOW"; reason: string };

export interface LunaThresholdReport {
  rows: ThresholdRow[];
  recommendation: Recommendation;
  luna: CallStats;
  llm: CallStats;
}

const POSITIVE: DecisionValue[] = ["ACCEPT", "REPAIR", "REPLACE"];
const NEGATIVE: DecisionValue[] = ["REJECT", "NEEDS_MANUAL_REVIEW"];

/** The hypothetical fast decision, or `null` when the run would not take FAST. */
function fastDecision(run: LunaEvalRun, threshold: number): DecisionValue | null {
  if (!run.eligible || !assess(run.answers, threshold).allCertain) return null;
  const mapped = mapToDecision(run.caseType, run.facts, run.answers);
  return mapped === "UNMAPPED" ? null : mapped.decision;
}

export function evaluateThresholds(runs: LunaEvalRun[]): LunaThresholdReport {
  const rows = LUNA_THRESHOLDS.map((threshold): ThresholdRow => {
    let fast = 0;
    let agreeing = 0;
    let unsafe = 0;
    for (const run of runs) {
      const d = fastDecision(run, threshold);
      if (d === null) continue;
      fast += 1;
      if (d === run.referenceDecision) agreeing += 1;
      if (POSITIVE.includes(d) && NEGATIVE.includes(run.referenceDecision)) unsafe += 1;
    }
    const coverage = runs.length ? fast / runs.length : 0;
    const agreement = fast ? agreeing / fast : null;
    const meetsCriteria =
      agreement !== null &&
      agreement >= EXIT_CRITERIA.minAgreement &&
      unsafe <= EXIT_CRITERIA.maxUnsafe &&
      coverage >= EXIT_CRITERIA.minCoverage;
    return { threshold, runs: runs.length, fast, coverage, agreeing, agreement, unsafe, meetsCriteria };
  });
  const best = rows.find((r) => r.meetsCriteria);
  const recommendation: Recommendation = best
    ? { kind: "SWITCH", threshold: best.threshold }
    : { kind: "STAY_IN_SHADOW", reason: "No threshold meets agreement >= 95%, zero unsafe disagreements and coverage >= 30%." };
  return {
    rows,
    recommendation,
    luna: callStats(runs.map((r) => r.lunaLatencyMs), runs.map((r) => r.lunaCostUsd)),
    llm: callStats(runs.map((r) => r.llmLatencyMs), runs.map((r) => r.llmCostUsd)),
  };
}
