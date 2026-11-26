// Per-run invariants (ADR 002 section 6.3). The eval never asserts a predetermined decision for
// the plain image matrix; it asserts only these.
import { decisionValuesFor, type CaseType } from "@/lib/shared";
import type { DecisionValue } from "@/server/domain";

export type InvariantCode = "NO_CLAUSES" | "UNKNOWN_CLAUSE" | "INVALID_DECISION_VALUE" | "NOT_POLISH" | "LATENCY";
export interface InvariantFailure {
  code: InvariantCode;
  message: string;
}

export interface CheckedDecision {
  decision: string;
  citedClauses: string[];
  justification: string[];
  nextSteps: string[];
}

export interface InvariantInput {
  caseType: CaseType;
  decision: CheckedDecision;
  /** All clause ids of the case type's policy. */
  clauseIds: Iterable<string>;
  latencyMs: number;
  budgetMs: number;
}

// Polish heuristic (documented, deliberately simple). Text is split into sentences. A sentence has
// "Polish evidence" if it contains a Polish diacritic or a Polish stop-word. The text is Polish when
// at least one sentence has Polish evidence AND no sentence is clearly English. A sentence is clearly
// English when it has 4+ words, no Polish evidence and 2+ common English stop-words. Short fragments
// and clause ids (R1.1) are tolerated.
const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const POLISH_STOP = new Set(
  "się nie jest oraz że dla przez czy jak ale lub który która które pkt na po od przy bez są był było ma zgłoszenie klient klienta".split(" "),
);
const ENGLISH_STOP = new Set(
  "the and is are was were of to with that this for not be have has in on it as at by from or an a".split(" "),
);

export function isPolish(texts: string[]): boolean {
  const sentences = texts.join("\n").split(/[.!?;\n]+/).map((s) => s.trim()).filter(Boolean);
  let polishEvidence = false;
  for (const s of sentences) {
    const words = s.toLowerCase().match(/\p{L}+/gu) ?? [];
    const hasPolish = DIACRITICS.test(s) || words.some((w) => POLISH_STOP.has(w));
    if (hasPolish) polishEvidence = true;
    else if (words.length >= 4 && words.filter((w) => ENGLISH_STOP.has(w)).length >= 2) return false;
  }
  return polishEvidence;
}

export function checkInvariants(input: InvariantInput): InvariantFailure[] {
  const { caseType, decision, latencyMs, budgetMs } = input;
  const failures: InvariantFailure[] = [];
  const known = new Set(input.clauseIds);

  if (!decisionValuesFor(caseType).includes(decision.decision as DecisionValue)) {
    failures.push({ code: "INVALID_DECISION_VALUE", message: `${decision.decision} is not allowed for ${caseType}` });
  }
  if (decision.citedClauses.length === 0) {
    failures.push({ code: "NO_CLAUSES", message: "no clauses cited" });
  }
  const unknown = decision.citedClauses.filter((c) => !known.has(c));
  if (unknown.length > 0) {
    failures.push({ code: "UNKNOWN_CLAUSE", message: `cited clauses not in the policy: ${unknown.join(", ")}` });
  }
  if (!isPolish([...decision.justification, ...decision.nextSteps])) {
    failures.push({ code: "NOT_POLISH", message: "justification/nextSteps do not look Polish" });
  }
  if (latencyMs > budgetMs) {
    failures.push({ code: "LATENCY", message: `latency ${latencyMs} ms > budget ${budgetMs} ms` });
  }
  return failures;
}

/** Share of runs whose final decision came from the guardrail fallback (`source: GUARDRAIL`). */
export function fallbackRate(results: { decisionSource: string }[]): number {
  if (results.length === 0) return 0;
  return results.filter((r) => r.decisionSource === "GUARDRAIL").length / results.length;
}
