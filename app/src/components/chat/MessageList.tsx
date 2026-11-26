"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import type { ApiErrorBody, ChatMessageMetadata } from "@/lib/shared";
import { MessageBubble, TypingIndicator } from "./MessageBubble";

export type ChatMessage = UIMessage<ChatMessageMetadata>;
export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

function parseApiError(error: Error | null | undefined): ApiErrorBody["error"] | null {
  if (!error) return null;
  try {
    const parsed = JSON.parse(error.message) as Partial<ApiErrorBody>;
    return parsed.error ?? null;
  } catch {
    return null;
  }
}

function hasText(message: ChatMessage | undefined) {
  return !!message?.parts.some((p) => p.type === "text" && p.text.length > 0);
}

export function MessageList({
  messages,
  status,
  error,
  onRetry,
  onNewCase,
}: {
  messages: ChatMessage[];
  status: ChatStatus;
  error: Error | null | undefined;
  onRetry: () => void;
  onNewCase: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const last = messages[messages.length - 1];
  const busy = status === "submitted" || status === "streaming";
  const showTyping = busy && !(last?.role === "assistant" && hasText(last));
  const apiError = parseApiError(error);
  const caseGone = apiError?.code === "CASE_NOT_FOUND";

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  });

  // Streaming assistant message that is still empty is represented by the typing indicator.
  const visible = messages.filter((m, i) => !(i === messages.length - 1 && m.role === "assistant" && m.parts.length === 0));

  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label="Rozmowa"
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className="flex-1 space-y-3 overflow-y-auto p-4"
    >
      {visible.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {showTyping ? <TypingIndicator /> : null}
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-end gap-3 text-sm text-status-negative">
          <span>
            {apiError?.message ?? "Nie udało się wysłać wiadomości. Spróbuj ponownie."}
          </span>
          {caseGone ? (
            <button type="button" onClick={onNewCase} className="min-h-11 rounded-lg bg-brand-primary px-4 font-bold text-text-on-dark">
              Nowe zgłoszenie
            </button>
          ) : (
            <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-border-brand px-4 font-bold text-text-brand">
              Ponów
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
