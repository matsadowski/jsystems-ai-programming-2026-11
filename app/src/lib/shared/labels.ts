// Polish UI labels (PRD AC-02, AC-03; ADR 002 §4.4).
import type {
  CaseType,
  DecisionPath,
  DecisionTone,
  DecisionValue,
  DeviceCategory,
} from "./enums";

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  RETURN: "Zwrot",
  COMPLAINT: "Reklamacja",
};

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  LAPTOP: "Laptop",
  SMARTPHONE: "Smartfon",
  TABLET: "Tablet",
  MONITOR_TV: "Monitor / TV",
  AUDIO: "Słuchawki / Audio",
  CAMERA: "Aparat",
  WEARABLE: "Smartwatch / Wearable",
  GAME_CONSOLE: "Konsola do gier",
  OTHER: "Inne",
};

interface LabelAndTone {
  label: string;
  tone: DecisionTone;
}

const RETURN_DECISION_LABELS: Record<"ACCEPT" | "REJECT" | "NEEDS_MANUAL_REVIEW", LabelAndTone> = {
  ACCEPT: { label: "Zwrot zaakceptowany", tone: "positive" },
  REJECT: { label: "Zwrot odrzucony", tone: "negative" },
  NEEDS_MANUAL_REVIEW: { label: "Wymaga weryfikacji", tone: "warning" },
};

const COMPLAINT_DECISION_LABELS: Record<
  "REPAIR" | "REPLACE" | "REFUND" | "REJECT" | "NEEDS_MANUAL_REVIEW",
  LabelAndTone
> = {
  REPAIR: { label: "Reklamacja uznana — naprawa", tone: "positive" },
  REPLACE: { label: "Reklamacja uznana — wymiana", tone: "positive" },
  REFUND: { label: "Reklamacja uznana — zwrot środków", tone: "positive" },
  REJECT: { label: "Reklamacja odrzucona", tone: "negative" },
  NEEDS_MANUAL_REVIEW: { label: "Wymaga weryfikacji", tone: "warning" },
};

/** Label and tone of a decision value; `REJECT` differs by case type. */
export function decisionLabel(caseType: CaseType, value: DecisionValue): LabelAndTone {
  const table: Record<string, LabelAndTone> =
    caseType === "RETURN" ? RETURN_DECISION_LABELS : COMPLAINT_DECISION_LABELS;
  const entry = table[value];
  if (!entry) throw new Error(`Decision ${value} is not valid for ${caseType}`);
  return entry;
}

/** ADR 003 §3.2 `DecisionPathLabel`. Shadow results are never shown. */
export const DECISION_PATH_LABELS: Record<DecisionPath, string> = {
  RULES: "Reguła terminu",
  FAST: "Szybka ocena automatyczna",
  LLM: "Pełna analiza AI",
  LLM_ESCALATED: "Pełna analiza AI (niepewna ocena wstępna)",
};

/** Mandatory disclaimer (PRD §11.5, ADR 002 §5.4, §7). Single source for server and UI. */
export const DISCLAIMER =
  "Decyzja jest rekomendacją wygenerowaną przez AI na podstawie zdjęcia, danych zgłoszenia i regulaminu. Ostateczną decyzję podejmuje pracownik.";
