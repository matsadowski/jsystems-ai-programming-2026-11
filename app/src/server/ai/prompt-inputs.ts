// Text blocks shared by the decision/chat prompts, the context builder and scripts/capture.ts
// (ADR 002 §5.1, ADR 004 §4.5). Pure. The employee reason is deliberately not part of the form text.
import { CATEGORY_LABELS } from "@/lib/shared/labels";
import type { CaseInput } from "@/lib/shared/case-input";
import { answerLabelPl, QUESTION_LABELS_PL } from "@/server/decisions/questions";
import type { DecisionFacts, ImageAnalysis, LunaAssessment } from "@/server/domain/case";

export function caseFormText(input: CaseInput): string {
  return [
    `Case type: ${input.caseType}`,
    `Device category: ${CATEGORY_LABELS[input.category]}`,
    `Model: ${input.model}`,
    `Purchase date: ${input.purchaseDate}`,
  ].join("\n");
}

export const factsText = (facts: DecisionFacts): string => JSON.stringify(facts, null, 2);

export const analysisText = (analysis: ImageAnalysis): string => JSON.stringify(analysis, null, 2);

/** One line per Luna answer; uncertain keys are marked "NIEPEWNE". */
export function preliminaryAssessmentText(luna: LunaAssessment): string {
  const uncertain = new Set(luna.uncertainKeys);
  return luna.answers
    .map((a) => {
      const name = QUESTION_LABELS_PL[a.key] ? `${a.key} (${QUESTION_LABELS_PL[a.key]})` : a.key;
      const certainty = a.certainty === null ? "brak" : `${Math.round(a.certainty * 100)}%`;
      const mark = uncertain.has(a.key) ? " — NIEPEWNE" : "";
      return `- ${name}: ${answerLabelPl(a.key, a.value)}, pewność: ${certainty}${mark}`;
    })
    .join("\n");
}
