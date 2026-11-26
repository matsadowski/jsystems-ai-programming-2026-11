// Markdown report for an eval run (ADR 002 section 6.3, ADR 004 section 6).
// Written by the runner to app/evals/reports/<date>-<model>.md (not committed).
import type { CellAgreement } from "./agreement";
import type { Budget } from "./budget";
import type { InvariantFailure } from "./invariants";
import type { CallStats } from "./stats";
import type { LunaThresholdReport } from "./luna-thresholds";

/** ADR 004 section 6 item 5. */
export const LIMITATION_SENTENCE = "10 images × 3 runs is a smoke test, not a statistical validation.";

export interface CaseRow {
  caseId: string;
  runs: number;
  decisions: string[];
  p50LatencyMs: number | null;
  costUsd: number | null;
  /** Targeted-case assertion result; `null` for matrix cases (invariants only). */
  passed: boolean | null;
}

export interface ReportInput {
  runDate: string;
  models: { vision: string; decision: string };
  promptVersions: Record<string, string>;
  policyVersion: string;
  budget: Pick<Budget, "maxUsd" | "spent" | "stopped" | "stopReason" | "unknownCostCalls">;
  cases: CaseRow[];
  invariantFailures: { caseId: string; run: number; failures: InvariantFailure[] }[];
  fallbackRate: number;
  agreement: CellAgreement[];
  luna?: { model: string; report: LunaThresholdReport };
}

const esc = (s: string) => s.replace(/\|/g, "\\|");
const pct = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)}%`);
const usd = (x: number | null) => (x === null ? "n/a" : `$${x.toFixed(4)}`);
const ms = (x: number | null | undefined) => (x == null ? "n/a" : `${Math.round(x)} ms`);
const table = (header: string[], rows: string[][]) =>
  [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

function stats(label: string, s: CallStats): string {
  const lat = s.latencyMs ? `p50 ${ms(s.latencyMs.p50)}, p95 ${ms(s.latencyMs.p95)}` : "no latency data";
  const unknown = s.unknownCost ? ` (${s.unknownCost} calls with unknown cost)` : "";
  return `- ${label}: ${lat}; mean cost per case ${usd(s.meanCostUsd)}${unknown}`;
}

export function renderReport(input: ReportInput): string {
  const { budget } = input;
  const out: string[] = [`# Eval report ${input.runDate}`, ""];
  out.push(
    `- Run date: ${input.runDate}`,
    `- Vision model: ${input.models.vision}`,
    `- Decision model: ${input.models.decision}`,
    ...(input.luna ? [`- Luna model: ${input.luna.model}`] : []),
    `- Prompt versions: ${Object.entries(input.promptVersions).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    `- Policy version: ${input.policyVersion}`,
    "",
    "## Budget",
    "",
    `- Spent: $${budget.spent.toFixed(4)} of $${budget.maxUsd} (EVAL_MAX_COST_USD)`,
    budget.stopped ? `- Budget stop: ${budget.stopReason ?? "yes"}` : "- No budget stop.",
    ...(budget.unknownCostCalls ? [`- Calls with unknown cost (counted as $0): ${budget.unknownCostCalls}`] : []),
    "",
    "## Cases",
    "",
    table(
      ["Case", "Runs", "Decisions", "p50 latency", "Cost", "Assertion"],
      input.cases.map((c) => [
        esc(c.caseId),
        String(c.runs),
        esc(c.decisions.join(", ")),
        ms(c.p50LatencyMs),
        usd(c.costUsd),
        c.passed === null ? "n/a (invariants only)" : c.passed ? "PASS" : "FAIL",
      ]),
    ),
    "",
    "## Invariant failures",
    "",
  );
  if (input.invariantFailures.length === 0) out.push("No invariant failures.");
  else {
    out.push(
      table(
        ["Case", "Run", "Code", "Detail"],
        input.invariantFailures.flatMap((f) => f.failures.map((x) => [esc(f.caseId), String(f.run), x.code, esc(x.message)])),
      ),
    );
  }
  out.push("", `Guardrail fallback rate: ${pct(input.fallbackRate)}`, "", "## Agreement across runs (target >= 2/3 per cell, reported only)", "");
  out.push(
    table(
      ["Cell", "Runs", "Modal decision", "Agreeing", "Rate", "Target"],
      input.agreement.map((a) => [esc(a.cellId), String(a.runs), a.modalDecision, String(a.agreeing), pct(a.rate), a.meetsTarget ? "met" : "not met"]),
    ),
  );
  if (input.luna) {
    const { report } = input.luna;
    out.push(
      "",
      "## Luna fast path by confidence threshold",
      "",
      table(
        ["Threshold", "Runs", "FAST", "Coverage", "Agreement", "Unsafe disagreements", "Meets exit criteria"],
        report.rows.map((r) => [r.threshold.toFixed(2), String(r.runs), String(r.fast), pct(r.coverage), pct(r.agreement), String(r.unsafe), r.meetsCriteria ? "yes" : "no"]),
      ),
      "",
      stats("Luna", report.luna),
      stats("LLM path", report.llm),
      "",
      "## Recommendation",
      "",
      report.recommendation.kind === "SWITCH"
        ? `Lowest threshold meeting the exit criteria: ${report.recommendation.threshold.toFixed(2)}. The user decides whether to switch DECISION_MODE to gated.`
        : `Stay in shadow. ${report.recommendation.reason}`,
    );
  }
  out.push("", "## Limitations", "", `${LIMITATION_SENTENCE} Shadow data from manual QA sessions (logged per case) extends the sample.`, "");
  return out.join("\n");
}
