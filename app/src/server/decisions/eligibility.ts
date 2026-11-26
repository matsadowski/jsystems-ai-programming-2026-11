// Fast-path eligibility (ADR 004 §4.3). Pure.
import type { CaseType, DeviceCategory } from "@/lib/shared";
import type { DecisionFacts } from "@/server/domain/case";

export type Eligibility =
  | { eligible: true }
  | { eligible: false; reason: "RULES" | "CATEGORY_OTHER" | "RETURN_AUDIO" };

export function isFastPathEligible(
  caseType: CaseType,
  category: DeviceCategory,
  facts: DecisionFacts,
): Eligibility {
  if (!facts.withinWindow) return { eligible: false, reason: "RULES" };
  if (category === "OTHER") return { eligible: false, reason: "CATEGORY_OTHER" };
  if (caseType === "RETURN" && category === "AUDIO") return { eligible: false, reason: "RETURN_AUDIO" };
  return { eligible: true };
}
