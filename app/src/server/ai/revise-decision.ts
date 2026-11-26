// Pure core of the `reviseDecision` chat tool (ADR 002 §4.5, §7 item 2). No I/O, no mutation:
// the caller persists `updated` when it is not null.
import { decisionLabel, decisionValuesFor, type DecisionValue } from "@/lib/shared";
import type { ReviseDecisionResult } from "@/lib/shared/api";
import type { ReviseDecisionInput } from "@/server/ai/schemas";
import type { Case, Decision } from "@/server/domain/case";

export interface RevisionContext {
  clauseIds: ReadonlySet<string>;
  nowIso: string;
  messageId?: string;
}

const fail = (error: Extract<ReviseDecisionResult, { ok: false }>["error"]) => ({
  result: { ok: false, error } as const,
  updated: null,
});

/** Next steps of the old decision stop making sense when the outcome flips to/from ACCEPT/REJECT. */
const isFlip = (from: DecisionValue, to: DecisionValue) =>
  [from, to].some((v) => v === "ACCEPT" || v === "REJECT");

export function applyRevision(
  c: Case,
  input: ReviseDecisionInput,
  ctx: RevisionContext,
): { result: ReviseDecisionResult; updated: Case | null } {
  const old = c.decision;
  if (!old) throw new Error("applyRevision requires a case with a decision");
  const caseType = c.input.caseType;
  const next = input.newDecision as DecisionValue;

  if (!(decisionValuesFor(caseType) as readonly string[]).includes(next)) {
    return fail("NOT_ALLOWED_FOR_CASE_TYPE");
  }
  if (next === old.decision) return fail("SAME_DECISION");
  if (!c.facts.withinWindow && next !== "REJECT") return fail("WINDOW_EXPIRED");
  const prefix = caseType === "RETURN" ? "R" : "C";
  if (input.citedClauses.some((id) => !id.startsWith(prefix) || !ctx.clauseIds.has(id))) {
    return fail("UNKNOWN_CLAUSE");
  }

  const decision: Decision = {
    decision: next,
    citedClauses: [...input.citedClauses],
    justification: [input.reason],
    nextSteps: isFlip(old.decision, next)
      ? [`Poinformuj klienta o zmianie decyzji (pkt ${input.citedClauses.join(", ")}).`]
      : [...old.nextSteps],
    // G5: NEEDS_MANUAL_REVIEW always lists what is missing.
    missingEvidence:
      next !== "NEEDS_MANUAL_REVIEW"
        ? []
        : old.missingEvidence.length > 0
          ? [...old.missingEvidence]
          : [`Ocena pracownika po nowej informacji: ${input.reason}`.slice(0, 300)],
    confidence: old.confidence,
    source: "CHAT_REVISION",
    violationsOnFirstAttempt: [],
  };

  const updated: Case = {
    ...c,
    decision,
    decisionHistory: [
      ...c.decisionHistory,
      {
        decision,
        at: ctx.nowIso,
        trigger: "CHAT_REVISION",
        ...(ctx.messageId !== undefined ? { messageId: ctx.messageId } : {}),
      },
    ],
  };
  return {
    result: {
      ok: true,
      from: old.decision,
      to: next,
      fromLabel: decisionLabel(caseType, old.decision).label,
      toLabel: decisionLabel(caseType, next).label,
    },
    updated,
  };
}
