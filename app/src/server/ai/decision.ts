// Decision step (ADR 002 §3.3, §5.1-5.3): model call -> guardrails -> one corrective retry ->
// deterministic fallback. Both attempts failing to parse is AiInvalidOutputError (no fallback).
import "server-only";
import { Output, generateText } from "ai";
import type { ModelMessage } from "ai";
import { getConfig } from "@/server/config/config";
import type { DecideArgs, Decision, DecisionValue } from "@/server/domain";
import { AiInvalidOutputError } from "@/server/http/errors";
import { logger } from "@/server/log/logger";
import { getPolicy } from "@/server/policies/policies";
import { toAppAiError } from "./errors";
import { checkDecision, fallbackDecision, type GuardrailContext, type Violation } from "./guardrails";
import { decisionModel, reasoningOptions } from "./models";
import { analysisText, caseFormText, factsText, preliminaryAssessmentText } from "./prompt-inputs";
import { loadPrompt, preliminaryAssessmentBlock } from "./prompts/load-prompt";
import { ComplaintDecisionOutputSchema, ReturnDecisionOutputSchema, type DecisionOutput } from "./schemas";

export const DECISION_BUDGET_MS = 35_000;

export interface DecideOptions {
  /** Overrides the 35 s budget shared by the call and its corrective retry (tests). */
  timeoutMs?: number;
}

const USER_PROMPT = "Give the decision for this case now.";

/** Employee text must not be able to close or open our delimiters. */
const neutralise = (text: string) => text.replace(/</g, "&lt;");

function correctivePrompt(violations: Violation[]): string {
  return [
    "Your previous answer violated these rules:",
    ...violations.map((v) => `- ${v.message}`),
    "Return a corrected decision that satisfies all rules.",
  ].join("\n");
}

type Attempt = { kind: "output"; output: DecisionOutput } | { kind: "unparseable"; error: AiInvalidOutputError };

export async function decideWithLlm(args: DecideArgs, options: DecideOptions = {}): Promise<Decision> {
  const { input, analysis, facts, preliminary, signal } = args;
  const caseType = input.caseType;
  const config = getConfig();
  const policy = getPolicy(caseType, config.policyDir);
  const prompt = loadPrompt(caseType === "RETURN" ? "decision-return" : "decision-complaint", {
    policy: policy.text,
    case_form: caseFormText(input),
    employee_reason: input.reason ? neutralise(input.reason) : "(none)",
    facts: factsText(facts),
    image_analysis: analysisText(analysis),
    preliminary_assessment: preliminaryAssessmentBlock(preliminary ? preliminaryAssessmentText(preliminary) : undefined),
  });
  const schema = caseType === "RETURN" ? ReturnDecisionOutputSchema : ComplaintDecisionOutputSchema;
  const budget = AbortSignal.timeout(options.timeoutMs ?? DECISION_BUDGET_MS);
  const abortSignal = signal ? AbortSignal.any([budget, signal]) : budget;
  const ctx: GuardrailContext = { caseType, facts, analysis, clauseIds: policy.clauseIds };

  const attempt = async (messages: ModelMessage[]): Promise<Attempt> => {
    try {
      const result = await generateText({
        model: decisionModel(),
        instructions: prompt.text,
        messages,
        output: Output.object({ schema }),
        providerOptions: reasoningOptions("decision"),
        maxRetries: 0,
        abortSignal,
      });
      return { kind: "output", output: result.output as DecisionOutput };
    } catch (error) {
      const mapped = toAppAiError(error, "decision");
      if (mapped instanceof AiInvalidOutputError) return { kind: "unparseable", error: mapped };
      throw mapped;
    }
  };

  const base: ModelMessage[] = [{ role: "user", content: USER_PROMPT }];
  const toDecision = (output: DecisionOutput, violationsOnFirstAttempt: string[]): Decision => ({
    ...output,
    decision: output.decision as DecisionValue,
    source: "MODEL",
    violationsOnFirstAttempt,
  });

  const first = await attempt(base);
  const firstViolations = first.kind === "output" ? checkDecision(first.output, ctx) : [];
  if (first.kind === "output" && firstViolations.length === 0) return toDecision(first.output, []);

  const retryMessages: ModelMessage[] =
    first.kind === "output"
      ? [
          ...base,
          { role: "assistant", content: JSON.stringify(first.output) },
          { role: "user", content: correctivePrompt(firstViolations) },
        ]
      : base;
  logger.info("decision_corrective_retry", {
    caseType,
    reason: first.kind === "output" ? "guardrails" : "unparseable",
    violations: firstViolations.map((v) => v.code),
  });

  const second = await attempt(retryMessages);
  if (second.kind === "unparseable") {
    if (first.kind === "unparseable") throw second.error;
    return fallbackDecision(ctx, firstViolations);
  }
  const secondViolations = checkDecision(second.output, ctx);
  if (secondViolations.length === 0) return toDecision(second.output, firstViolations.map((v) => v.code));
  logger.warn("decision_fallback", { caseType, violations: secondViolations.map((v) => v.code) });
  return fallbackDecision(ctx, first.kind === "output" ? firstViolations : secondViolations);
}
