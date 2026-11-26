// Chat turn use case (ADR 001 §5.3, ADR 002 §7). Checks run before the stream starts and throw
// AppErrors (JSON responses). Once streaming, errors become an error chunk with a fixed Polish
// text; nothing is persisted for the assistant and the busy flag is always released.
// Logs carry ids and counts only, never message text (TAC-001-05).
import "server-only";
import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";
import type { ChatMessageMetadata } from "@/lib/shared/api";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/shared/limits";
import { chatStream, stripReasoning } from "@/server/ai/chat";
import { toAppAiError } from "@/server/ai/errors";
import {
  CHAT_STREAM_ERROR_MESSAGE,
  CaseNotDecidedError,
  CaseNotFoundError,
  ChatBusyError,
} from "@/server/http/errors";
import { logger } from "@/server/log/logger";
import { toDecisionDTO } from "./mappers";
import type { CaseServiceDeps } from "./services";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `POST /api/chat` body: `{ caseId, message }` with exactly one trimmed text part (ADR 001 §5.3). */
export const ChatRequestSchema = z.object({
  caseId: z.string().regex(UUID, "Nieprawidłowy identyfikator zgłoszenia"),
  message: z.object({
    id: z.string().min(1, "Nieprawidłowa wiadomość").max(200, "Nieprawidłowa wiadomość"),
    role: z.literal("user", "Nieprawidłowa wiadomość"),
    parts: z
      .array(
        z.object({
          type: z.literal("text", "Nieprawidłowa wiadomość"),
          text: z
            .string()
            .transform((t) => t.trim())
            .pipe(
              z
                .string()
                .min(1, "Wpisz wiadomość")
                .max(CHAT_MESSAGE_MAX_LENGTH, `Wiadomość może mieć maksymalnie ${CHAT_MESSAGE_MAX_LENGTH} znaków.`),
            ),
        }),
      )
      .length(1, "Wiadomość musi zawierać jedną część tekstową"),
  }),
});
export type ChatRequest = z.output<typeof ChatRequestSchema>;

export type ChatServiceDeps = Pick<CaseServiceDeps, "repo" | "clock" | "newId">;

export interface ChatTurnOptions {
  /** Request abort signal (client disconnect). */
  signal?: AbortSignal;
  /** Extra response headers, e.g. `x-request-id`. */
  headers?: HeadersInit;
}

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

/**
 * Runs one chat turn and returns the UI message stream response.
 * Throws CaseNotFoundError (404), CaseNotDecidedError (409), ChatBusyError (409) or any error
 * raised while preparing the turn (e.g. ConfigError 503); the busy flag is released in that case.
 */
export async function startChatTurn(
  deps: ChatServiceDeps,
  request: ChatRequest,
  options: ChatTurnOptions = {},
): Promise<Response> {
  const { repo } = deps;
  const { caseId } = request;
  const existing = repo.get(caseId);
  if (!existing) throw new CaseNotFoundError();
  if (existing.status !== "DECIDED" || !existing.decision) throw new CaseNotDecidedError();
  if (!repo.tryAcquireChat(caseId)) throw new ChatBusyError();

  const userMessage: ChatUIMessage = {
    id: request.message.id,
    role: "user",
    parts: [{ type: "text", text: request.message.parts[0].text }],
  };

  // The SDK reports a stream error as an error chunk and may still end with a "completed" outcome,
  // so failures are tracked here: a failed turn never persists the assistant message.
  let failed = false;
  try {
    // The user message stays in the history even when the answer fails; a resend of the same id
    // (the "Ponów" retry) must not duplicate it.
    const withUser = repo.update(caseId, (c) =>
      c.messages.at(-1)?.id === userMessage.id ? c : { ...c, messages: [...c.messages, userMessage] },
    );
    if (!withUser) throw new CaseNotFoundError();

    const result = await chatStream(withUser, {
      repo,
      clock: deps.clock,
      userMessage,
      ...(options.signal ? { signal: options.signal } : {}),
      onError: (error) => {
        failed = true;
        logger.warn("chat_stream_error", { caseId, error: toAppAiError(error, "chat") });
      },
    });

    const stream = toUIMessageStream({
      stream: result.stream,
      originalMessages: withUser.messages as ChatUIMessage[],
      generateMessageId: deps.newId,
      sendReasoning: false,
      messageMetadata: ({ part }) => {
        if (part.type !== "finish") return undefined;
        const current = repo.get(caseId);
        return current?.decision ? { decision: toDecisionDTO(current) } : undefined;
      },
      onError: () => {
        failed = true;
        return CHAT_STREAM_ERROR_MESSAGE;
      },
      onEnd: ({ responseMessage, outcome, isAborted, isCancelled }) => {
        try {
          const completed = outcome.status === "completed" && !failed && !isAborted && !isCancelled;
          const assistant = stripReasoning(responseMessage);
          if (completed && assistant.parts.length > 0) {
            repo.update(caseId, (c) => ({ ...c, messages: [...c.messages, assistant] }));
          }
          logger.info("chat_turn_end", { caseId, outcome: outcome.status, persisted: completed, parts: assistant.parts.length });
        } finally {
          repo.releaseChat(caseId);
        }
      },
    });

    return createUIMessageStreamResponse({ stream, ...(options.headers ? { headers: options.headers } : {}) });
  } catch (error) {
    repo.releaseChat(caseId);
    throw error;
  }
}
