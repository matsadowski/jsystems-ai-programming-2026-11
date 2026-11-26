// Case -> API DTO mappers (ADR 001 §4.3, ADR 004 §5). Pure; no bytes or reason text beyond the DTO fields.
import type {
  AnalysisDTO,
  AssessmentDTO,
  CaseSummary,
  DecisionDTO,
  TextUIMessage,
} from "@/lib/shared/api";
import { CASE_TYPE_LABELS, CATEGORY_LABELS, decisionLabel } from "@/lib/shared/labels";
import type { Case } from "@/server/domain";
import { answerLabelPl, QUESTION_LABELS_PL } from "@/server/decisions/questions";

export function toCaseSummary(c: Case): CaseSummary {
  return {
    caseId: c.id,
    caseType: c.input.caseType,
    caseTypeLabel: CASE_TYPE_LABELS[c.input.caseType],
    category: c.input.category,
    categoryLabel: CATEGORY_LABELS[c.input.category],
    model: c.input.model,
    purchaseDate: c.input.purchaseDate,
    reason: c.input.reason,
  };
}

export function toAnalysisDTO(c: Case): AnalysisDTO | null {
  if (!c.analysis) return null;
  return {
    summary: c.analysis.summary,
    photoQuality: c.analysis.photoQuality,
    matchesDeclaredCategory: c.analysis.matchesDeclaredCategory,
  };
}

/** Shown only for FAST and LLM_ESCALATED (ADR 004 §4.6); shadow results are never shown. */
export function toAssessmentDTO(c: Case): AssessmentDTO | null {
  const luna = c.lunaAssessment;
  if (!luna || (c.decisionPath !== "FAST" && c.decisionPath !== "LLM_ESCALATED")) return null;
  const uncertain = new Set([...luna.uncertainKeys, ...luna.refusedKeys]);
  return {
    items: luna.answers.map((a) => ({
      key: a.key,
      label: QUESTION_LABELS_PL[a.key] ?? a.key,
      answerLabel: answerLabelPl(a.key, a.value),
      certaintyPct: a.certainty === null ? null : Math.round(a.certainty * 100),
      certain: !uncertain.has(a.key),
    })),
    uncertainKeys: [...luna.uncertainKeys],
  };
}

export function toDecisionDTO(c: Case): DecisionDTO {
  if (!c.decision) throw new Error("Case has no decision");
  const { label, tone } = decisionLabel(c.input.caseType, c.decision.decision);
  return {
    value: c.decision.decision,
    label,
    tone,
    daysSincePurchase: c.facts.daysSincePurchase,
    citedClauses: [...c.decision.citedClauses],
    decisionPath: c.decisionPath,
  };
}

export function toTextUIMessage(message: Case["messages"][number]): TextUIMessage {
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    parts: message.parts.flatMap((p) => (p.type === "text" ? [{ type: "text" as const, text: p.text }] : [])),
  };
}
