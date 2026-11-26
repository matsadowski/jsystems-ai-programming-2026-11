// Derives the current DecisionDTO from the conversation (ADR 003 §6.3): a successful
// `reviseDecision` tool part updates it early, finish metadata is authoritative.
import { decisionLabel, type CaseType, type DecisionDTO, type DecisionValue, type ReviseDecisionResult } from "@/lib/shared";
import type { ChatMessage } from "./MessageList";

export interface ReviseToolPart {
  type: "tool-reviseDecision";
  state: string;
  input?: { reason?: string; citedClauses?: string[] };
  output?: ReviseDecisionResult;
}

export function isReviseToolPart(part: { type: string }): part is ReviseToolPart {
  return part.type === "tool-reviseDecision";
}

export function successfulRevision(part: ReviseToolPart) {
  return part.state === "output-available" && part.output?.ok === true ? part.output : null;
}

export function deriveDecision(initial: DecisionDTO, caseType: CaseType, messages: ChatMessage[]): DecisionDTO {
  let current = initial;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isReviseToolPart(part)) continue;
      const out = successfulRevision(part);
      if (!out) continue;
      const to = out.to as DecisionValue;
      let tone = current.tone;
      try {
        tone = decisionLabel(caseType, to).tone;
      } catch {
        // keep the previous tone for a value outside the case-type set
      }
      current = {
        ...current,
        value: to,
        label: out.toLabel,
        tone,
        citedClauses: part.input?.citedClauses ?? current.citedClauses,
      };
    }
    if (message.metadata?.decision) current = message.metadata.decision;
  }
  return current;
}
