// Renders the first assistant message (ADR 002 §5.4, PRD AC-24, §11.5). Pure.
import {
  CASE_TYPE_LABELS,
  CATEGORY_LABELS,
  decisionLabel,
  type CaseType,
  type DeviceCategory,
} from "@/lib/shared";
import type { TextUIMessage } from "@/lib/shared/api";
import type { Decision, DecisionFacts } from "@/server/domain/case";

export const DISCLAIMER =
  "Decyzja jest rekomendacją wygenerowaną przez AI na podstawie zdjęcia, danych zgłoszenia i regulaminu. Ostateczną decyzję podejmuje pracownik.";

/** Single-line, with a leading `#`, `>` or `<` backslash-escaped. */
function safe(text: string): string {
  return text
    .replace(/\s*[\r\n]+\s*/g, " ")
    .trim()
    .replace(/^([#><])/, "\\$1");
}

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export interface RenderFirstMessageArgs {
  caseType: CaseType;
  category: DeviceCategory;
  model: string;
  purchaseDate: string;
  facts: DecisionFacts;
  decision: Decision;
}

export function renderFirstMessage(args: RenderFirstMessageArgs): string {
  const { caseType, category, model, purchaseDate, facts, decision } = args;
  const bullets = (items: string[]) => items.map((i) => `- ${safe(i)}`).join("\n");
  const sections = [
    `Dzień dobry, przeanalizowałem zgłoszenie **${CASE_TYPE_LABELS[caseType]}** dotyczące: ${CATEGORY_LABELS[category]} — ${safe(model)}.`,
    `### Decyzja: ${decisionLabel(caseType, decision.decision).label}`,
    `Od daty zakupu (${displayDate(purchaseDate)}) minęło **${facts.daysSincePurchase} dni**.`,
    `#### Uzasadnienie\n\n${bullets(decision.justification)}`,
  ];
  if (decision.decision === "NEEDS_MANUAL_REVIEW") {
    sections.push(`#### Brakujące informacje\n\n${bullets(decision.missingEvidence)}`);
  }
  sections.push(
    `#### Kolejne kroki\n\n${decision.nextSteps.map((s, i) => `${i + 1}. ${safe(s)}`).join("\n")}`,
    `*${DISCLAIMER}*`,
  );
  return sections.join("\n\n") + "\n";
}

export function firstMessageUIMessage(id: string, markdown: string): TextUIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text: markdown }] };
}
