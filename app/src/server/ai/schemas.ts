// Zod schemas for structured LLM outputs (ADR 002 §4) and the reviseDecision tool input.
// No refinements here: these schemas are sent to the model as JSON Schema. Cross-field rules
// (e.g. missingEvidence for NEEDS_MANUAL_REVIEW) are guardrails (002 §5.2).
import { z } from "zod";
import { COMPLAINT_DECISIONS, RETURN_DECISIONS } from "@/lib/shared/enums";

const severity4 = z.enum(["NONE", "MINOR", "MODERATE", "SEVERE"]);
const severity3 = z.enum(["MINOR", "MODERATE", "SEVERE"]);
const yesNoUncertain = z.enum(["YES", "NO", "UNCERTAIN"]);

const commonAnalysis = {
  deviceVisible: z.boolean(),
  detectedDevice: z.string().max(120),
  matchesDeclaredCategory: yesNoUncertain,
  photoQuality: z.enum(["SUFFICIENT", "INSUFFICIENT"]),
  qualityIssues: z.array(
    z.enum(["BLURRY", "TOO_DARK", "OVEREXPOSED", "PARTIAL_VIEW", "OBSTRUCTED", "LOW_RESOLUTION"]),
  ),
  observations: z
    .array(z.object({ area: z.string(), finding: z.string(), severity: severity4 }))
    .max(12),
  summary: z.string().min(1),
};

export const ReturnImageAnalysisSchema = z.object({
  ...commonAnalysis,
  signsOfUse: z.enum(["NONE_VISIBLE", "MINOR", "CLEAR", "CANNOT_DETERMINE"]),
  resaleableAsNew: yesNoUncertain,
  packagingOrAccessoriesVisible: z.array(z.string()),
});

export const ComplaintImageAnalysisSchema = z.object({
  ...commonAnalysis,
  describedDefectVisible: z.enum(["YES", "NO", "NOT_PHOTOGRAPHABLE", "UNCERTAIN"]),
  damage: z
    .array(z.object({ type: z.string(), location: z.string(), severity: severity3 }))
    .max(8),
  likelyCauses: z
    .array(
      z.object({
        cause: z.string(),
        classification: z.enum(["MANUFACTURING_DEFECT", "USER_CAUSED", "NORMAL_WEAR", "UNKNOWN"]),
        likelihood: z.enum(["LOW", "MEDIUM", "HIGH"]),
        evidence: z.string(),
      }),
    )
    .max(5),
});

export type ReturnImageAnalysis = z.infer<typeof ReturnImageAnalysisSchema>;
export type ComplaintImageAnalysis = z.infer<typeof ComplaintImageAnalysisSchema>;
export type ImageAnalysis = ReturnImageAnalysis | ComplaintImageAnalysis;

export const RETURN_CLAUSE_PATTERN = /^R\d+(\.\d+)?$/;
export const COMPLAINT_CLAUSE_PATTERN = /^C\d+(\.\d+)?$/;

const bullets = (min: number, max: number) => z.array(z.string().min(1).max(300)).min(min).max(max);

function decisionOutputSchema<T extends readonly [string, ...string[]]>(
  values: T,
  clausePattern: RegExp,
) {
  return z.object({
    decision: z.enum(values),
    citedClauses: z.array(z.string().regex(clausePattern)).min(1).max(6),
    justification: bullets(1, 6),
    nextSteps: bullets(1, 6),
    missingEvidence: z.array(z.string().min(1).max(300)).max(5),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  });
}

export const ReturnDecisionOutputSchema = decisionOutputSchema(
  RETURN_DECISIONS,
  RETURN_CLAUSE_PATTERN,
);
export const ComplaintDecisionOutputSchema = decisionOutputSchema(
  COMPLAINT_DECISIONS,
  COMPLAINT_CLAUSE_PATTERN,
);

export type DecisionOutput =
  | z.infer<typeof ReturnDecisionOutputSchema>
  | z.infer<typeof ComplaintDecisionOutputSchema>;

/** Tool input; the case-type check of `newDecision` happens in the tool (ADR 002 §4.5). */
export const ReviseDecisionInputSchema = z.object({
  newDecision: z.enum([...new Set([...RETURN_DECISIONS, ...COMPLAINT_DECISIONS])] as [
    string,
    ...string[],
  ]),
  reason: z.string().min(10).max(500),
  citedClauses: z
    .array(z.string().regex(/^[RC]\d+(\.\d+)?$/))
    .min(1)
    .max(6),
});
export type ReviseDecisionInput = z.infer<typeof ReviseDecisionInputSchema>;
