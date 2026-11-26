// Chat turn (ADR 002 §3.3, §7): `streamText` with the single `reviseDecision` tool. The tool
// commits through the repository immediately, so a revision survives a later stream error.
import "server-only";
import { convertToModelMessages, isStepCount, streamText, tool } from "ai";
import type { UIMessage } from "ai";
import { getConfig } from "@/server/config/config";
import type { Case, CaseRepository, Clock } from "@/server/domain";
import { getPolicy } from "@/server/policies/policies";
import { buildCaseContext } from "./context";
import { decisionModel, reasoningOptions } from "./models";
import { loadPrompt } from "./prompts/load-prompt";
import { applyRevision } from "./revise-decision";
import { ReviseDecisionInputSchema } from "./schemas";

export const CHAT_FIRST_CHUNK_MS = 20_000;
export const CHAT_TOTAL_MS = 60_000;

export interface ChatHooks {
  repo: CaseRepository;
  clock: Clock;
  /** The new user message. Not duplicated when it is already the last message of the case. */
  userMessage: UIMessage;
  /** Request abort (client disconnect). */
  signal?: AbortSignal;
  /** Called with every stream error (the SDK would otherwise print it to the console). */
  onError?: (error: unknown) => void;
  /** Overrides the 20 s / 60 s budgets (tests). */
  timeout?: { firstChunkMs: number; totalMs: number };
}

/** Reasoning is never streamed or stored (TAC-002-05). */
export function stripReasoning<M extends UIMessage>(message: M): M {
  return { ...message, parts: message.parts.filter((p) => p.type !== "reasoning") };
}

function modelMessages(c: Case, userMessage: UIMessage): UIMessage[] {
  const last = c.messages.at(-1);
  return last?.id === userMessage.id ? c.messages : [...c.messages, userMessage];
}

export async function chatStream(c: Case, hooks: ChatHooks) {
  const config = getConfig();
  const policy = getPolicy(c.input.caseType, config.policyDir);
  const prompt = loadPrompt("chat-system", { policy: policy.text, case_context: buildCaseContext(c) });

  const reviseDecision = tool({
    description:
      "Revise the recommended decision when the employee supplies a new fact that matters under the policy.",
    inputSchema: ReviseDecisionInputSchema,
    execute: async (input) => {
      let result: ReturnType<typeof applyRevision>["result"] | undefined;
      const stored = hooks.repo.update(c.id, (current) => {
        const applied = applyRevision(current, input, {
          clauseIds: policy.clauseIds,
          nowIso: hooks.clock.now().toISOString(),
          messageId: hooks.userMessage.id,
        });
        result = applied.result;
        return applied.updated ?? current;
      });
      if (!stored || !result) throw new Error("Case expired during the chat turn");
      return result;
    },
  });
  const tools = { reviseDecision };

  return streamText({
    model: decisionModel(),
    instructions: prompt.text,
    messages: await convertToModelMessages(modelMessages(c, hooks.userMessage), {
      tools,
      ignoreIncompleteToolCalls: true,
    }),
    tools,
    stopWhen: isStepCount(3),
    providerOptions: reasoningOptions("chat"),
    maxRetries: 1,
    timeout: hooks.timeout ?? { firstChunkMs: CHAT_FIRST_CHUNK_MS, totalMs: CHAT_TOTAL_MS },
    onError: ({ error }) => hooks.onError?.(error),
    ...(hooks.signal ? { abortSignal: hooks.signal } : {}),
  });
}
