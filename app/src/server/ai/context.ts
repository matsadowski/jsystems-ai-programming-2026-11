// Delimited case context for the decision and chat prompts (ADR 002 §3.1, §5.1, ADR 004 §4.6).
// Phase 2 seam: purchase history and retrieved passages are added here.
import { decisionLabel } from "@/lib/shared/labels";
import type { Case, Decision } from "@/server/domain/case";
import { analysisText, caseFormText, factsText, preliminaryAssessmentText } from "./prompt-inputs";

const block = (tag: string, body: string) => `<${tag}>\n${body}\n</${tag}>`;

/** Employee text must not be able to close or open our delimiters. */
const neutralise = (text: string) => text.replace(/</g, "&lt;");

function pathBlocks(c: Case): string[] {
  switch (c.decisionPath) {
    case "LLM":
    case "LLM_ESCALATED":
      return c.analysis ? [block("image_analysis", analysisText(c.analysis))] : [];
    case "FAST":
      return [
        block(
          "luna_answers",
          [
            "Fast automatic assessment (no photo description exists). Answers:",
            c.lunaAssessment ? preliminaryAssessmentText(c.lunaAssessment) : "(none)",
            "Visual details beyond these answers cannot be determined. Do not guess them; ask for a new photo or a physical inspection.",
          ].join("\n"),
        ),
      ];
    case "RULES":
      return [
        block(
          "image_analysis_note",
          "The photo was not analysed because the window expired. Visual details cannot be determined; do not guess them.",
        ),
      ];
  }
}

function decisionLine(c: Case, d: Decision): string {
  return `${d.decision} (${decisionLabel(c.input.caseType, d.decision).label}), clauses: ${d.citedClauses.join(", ")}`;
}

export function buildCaseContext(c: Case): string {
  const current = c.decision
    ? [
        `Decision: ${c.decision.decision}`,
        `Label: ${decisionLabel(c.input.caseType, c.decision.decision).label}`,
        `Clauses: ${c.decision.citedClauses.join(", ")}`,
        `Justification: ${c.decision.justification.join(" | ")}`,
      ].join("\n")
    : "(no decision yet)";
  const history = c.decisionHistory.length
    ? c.decisionHistory
        .map((h) => `- ${h.at} ${h.trigger}: ${decisionLine(c, h.decision)}${h.messageId ? ` [message ${h.messageId}]` : ""}`)
        .join("\n")
    : "(empty)";
  return [
    block("case_form", caseFormText(c.input)),
    block("employee_reason", c.input.reason ? neutralise(c.input.reason) : "(none)"),
    block("facts", factsText(c.facts)),
    ...pathBlocks(c),
    block("current_decision", current),
    block("decision_history", history),
  ].join("\n\n");
}
