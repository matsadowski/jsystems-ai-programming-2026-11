// Enum constants (English, uppercase). Polish display labels live in ./labels.
export const CASE_TYPES = ["RETURN", "COMPLAINT"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

/** PRD AC-03, in display order. */
export const DEVICE_CATEGORIES = [
  "LAPTOP",
  "SMARTPHONE",
  "TABLET",
  "MONITOR_TV",
  "AUDIO",
  "CAMERA",
  "WEARABLE",
  "GAME_CONSOLE",
  "OTHER",
] as const;
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

export const RETURN_DECISIONS = ["ACCEPT", "REJECT", "NEEDS_MANUAL_REVIEW"] as const;
export type ReturnDecisionValue = (typeof RETURN_DECISIONS)[number];

export const COMPLAINT_DECISIONS = [
  "REPAIR",
  "REPLACE",
  "REFUND",
  "REJECT",
  "NEEDS_MANUAL_REVIEW",
] as const;
export type ComplaintDecisionValue = (typeof COMPLAINT_DECISIONS)[number];

export type DecisionValue = ReturnDecisionValue | ComplaintDecisionValue;

export function decisionValuesFor(caseType: CaseType): readonly DecisionValue[] {
  return caseType === "RETURN" ? RETURN_DECISIONS : COMPLAINT_DECISIONS;
}

/** ADR 004 §3.2. */
export const DECISION_PATHS = ["RULES", "FAST", "LLM", "LLM_ESCALATED"] as const;
export type DecisionPath = (typeof DECISION_PATHS)[number];

/** ADR 004 §3.1. */
export const DECISION_MODES = ["llm_only", "shadow", "gated"] as const;
export type DecisionMode = (typeof DECISION_MODES)[number];

export type DecisionTone = "positive" | "negative" | "warning";
export type MatchesCategory = "YES" | "NO" | "UNCERTAIN";
export type PhotoQuality = "SUFFICIENT" | "INSUFFICIENT";
