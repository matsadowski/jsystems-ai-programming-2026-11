// Decision guardrails G1-G6, deterministic fallback and expired-window decision
// (ADR 002 §5.2-5.3, ADR 004 §7.2). Pure: no AI SDK imports.
import { decisionValuesFor, type CaseType } from "@/lib/shared";
import type { DecisionOutput, ImageAnalysis } from "@/server/ai/schemas";
import type { Decision, DecisionFacts } from "@/server/domain/case";

export type ViolationCode =
  | "NOT_ALLOWED"
  | "WINDOW_EXPIRED_NOT_REJECTED"
  | "INSUFFICIENT_EVIDENCE_NOT_REVIEW"
  | "DEFECT_NOT_VISIBLE_NOT_REVIEW"
  | "UNKNOWN_CLAUSE"
  | "MISSING_EVIDENCE_EMPTY"
  | "ACCEPT_WITH_VISIBLE_USE";

/** `message` is plain English, used in the corrective prompt. */
export interface Violation {
  code: ViolationCode;
  message: string;
}

export interface GuardrailContext {
  caseType: CaseType;
  facts: DecisionFacts;
  /** `null` on RULES/FAST paths: G3/G3c/G6 are skipped. */
  analysis: ImageAnalysis | null;
  clauseIds: ReadonlySet<string>;
}

const REVIEW = "NEEDS_MANUAL_REVIEW";
const prefixOf = (caseType: CaseType) => (caseType === "RETURN" ? "R" : "C");

export function checkDecision(output: DecisionOutput, ctx: GuardrailContext): Violation[] {
  const { caseType, facts, analysis, clauseIds } = ctx;
  const violations: Violation[] = [];
  const add = (code: ViolationCode, message: string) => violations.push({ code, message });
  const prefix = prefixOf(caseType);
  const decision: string = output.decision;

  // G1
  if (!(decisionValuesFor(caseType) as readonly string[]).includes(decision)) {
    add("NOT_ALLOWED", `Decision ${decision} is not allowed for a ${caseType} case.`);
  }

  if (!facts.withinWindow) {
    // G2 takes precedence over G3: an expired window makes the evidence irrelevant.
    const clause = `${prefix}1.3`;
    if (decision !== "REJECT" || !output.citedClauses.includes(clause)) {
      add(
        "WINDOW_EXPIRED_NOT_REJECTED",
        `facts.withinWindow is false; policy ${clause} requires REJECT citing ${clause}.`,
      );
    }
  } else if (analysis) {
    // G3
    if (
      (!analysis.deviceVisible ||
        analysis.photoQuality === "INSUFFICIENT" ||
        analysis.matchesDeclaredCategory !== "YES") &&
      decision !== REVIEW
    ) {
      add(
        "INSUFFICIENT_EVIDENCE_NOT_REVIEW",
        "The image analysis shows no visible device, an insufficient photo, or a device that does not clearly match the declared category; the decision must be NEEDS_MANUAL_REVIEW.",
      );
    }
    // G3c (NOT_PHOTOGRAPHABLE never triggers it)
    if (
      "describedDefectVisible" in analysis &&
      (analysis.describedDefectVisible === "NO" || analysis.describedDefectVisible === "UNCERTAIN") &&
      decision !== REVIEW
    ) {
      add(
        "DEFECT_NOT_VISIBLE_NOT_REVIEW",
        "The described defect is not visible or uncertain in the photo; the decision must be NEEDS_MANUAL_REVIEW.",
      );
    }
  }

  // G4
  const unknown = output.citedClauses.filter((c) => !c.startsWith(prefix) || !clauseIds.has(c));
  if (unknown.length > 0) {
    add(
      "UNKNOWN_CLAUSE",
      `Cited clauses must exist in the policy and start with ${prefix}; invalid: ${unknown.join(", ")}.`,
    );
  }

  // G5
  if (decision === REVIEW && output.missingEvidence.length === 0) {
    add("MISSING_EVIDENCE_EMPTY", "NEEDS_MANUAL_REVIEW requires a non-empty missingEvidence list.");
  }

  // G6
  if (
    facts.withinWindow &&
    analysis &&
    "signsOfUse" in analysis &&
    decision === "ACCEPT" &&
    (analysis.signsOfUse === "CLEAR" || analysis.resaleableAsNew === "NO")
  ) {
    add(
      "ACCEPT_WITH_VISIBLE_USE",
      "ACCEPT is not allowed when signs of use are clearly visible or the device is not resaleable as new.",
    );
  }

  return violations;
}

export function expiredWindowDecision(
  caseType: CaseType,
  facts: DecisionFacts,
  source: "RULES" | "GUARDRAIL",
): Decision {
  const isReturn = caseType === "RETURN";
  const clause = isReturn ? "R1.3" : "C1.3";
  const windowText = isReturn ? "14 dni" : "24 miesiące";
  return {
    decision: "REJECT",
    citedClauses: [clause],
    justification: [
      `Od daty zakupu minęło ${facts.daysSincePurchase} dni, a termin wynosi ${windowText} (pkt ${clause}).`,
      isReturn
        ? "Jeśli klient zgłasza wadę, można rozważyć reklamację."
        : "Może obowiązywać gwarancja producenta.",
    ],
    nextSteps: [
      isReturn
        ? `Poinformuj klienta, że termin na zwrot upłynął (pkt ${clause}).`
        : `Poinformuj klienta, że termin na reklamację upłynął (pkt ${clause}).`,
    ],
    missingEvidence: [],
    confidence: "HIGH",
    source,
    violationsOnFirstAttempt: [],
  };
}

const QUALITY_ISSUE_PL: Record<string, string> = {
  BLURRY: "Wyraźniejsze, ostre zdjęcie",
  TOO_DARK: "Zdjęcie przy lepszym oświetleniu",
  OVEREXPOSED: "Zdjęcie bez prześwietlenia",
  PARTIAL_VIEW: "Zdjęcie całego urządzenia",
  OBSTRUCTED: "Zdjęcie bez zasłoniętych elementów",
  LOW_RESOLUTION: "Zdjęcie w wyższej rozdzielczości",
};
const INCONSISTENT_EVIDENCE = "Automatyczna ocena była niespójna — wymagana ocena pracownika";

export function fallbackDecision(ctx: GuardrailContext, violations: Violation[]): Decision {
  const codes = violations.map((v) => v.code);
  const base = (): Decision => {
    if (codes.includes("WINDOW_EXPIRED_NOT_REJECTED") || !ctx.facts.withinWindow) {
      return expiredWindowDecision(ctx.caseType, ctx.facts, "GUARDRAIL");
    }
    const clause = ctx.caseType === "RETURN" ? "R4.1" : "C4.2";
    const issues = (ctx.analysis?.qualityIssues ?? []).map((q) => QUALITY_ISSUE_PL[q]);
    return {
      decision: REVIEW,
      citedClauses: [clause],
      justification: [`Automatyczna ocena nie pozwoliła na jednoznaczną decyzję (pkt ${clause}).`],
      nextSteps: [`Przekaż zgłoszenie do oceny pracownika (pkt ${clause}).`],
      missingEvidence: issues.length > 0 ? issues.slice(0, 5) : [INCONSISTENT_EVIDENCE],
      confidence: "LOW",
      source: "GUARDRAIL",
      violationsOnFirstAttempt: [],
    };
  };
  return { ...base(), violationsOnFirstAttempt: codes };
}
