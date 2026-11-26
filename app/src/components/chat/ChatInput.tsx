"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/shared";

const COUNTER_FROM = 1800;
const MAX_LINES = 6;
const LINE_HEIGHT_PX = 24;

export function ChatInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const tooLong = value.length > CHAT_MESSAGE_MAX_LENGTH;
  const empty = value.trim().length === 0;
  const canSend = !disabled && !empty && !tooLong;

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_LINES * LINE_HEIGHT_PX + 16)}px`;
  }

  function submit() {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    requestAnimationFrame(resize);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      className="border-t border-border-default bg-bg-default p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          aria-label="Wiadomość"
          aria-invalid={tooLong}
          aria-describedby="chat-input-hint"
          rows={1}
          value={value}
          placeholder="Napisz wiadomość…"
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          className="min-h-11 flex-1 resize-none rounded-sm border border-border-neutral-strong px-3 py-2 text-base"
          style={{ maxHeight: MAX_LINES * LINE_HEIGHT_PX + 16 }}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="min-h-11 rounded-lg bg-brand-primary px-5 font-bold text-text-on-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Wyślij
        </button>
      </div>
      <div id="chat-input-hint" className="mt-1 flex justify-between text-sm">
        <span role={tooLong ? "alert" : undefined} className="text-status-negative">
          {tooLong ? `Wiadomość może mieć maksymalnie ${CHAT_MESSAGE_MAX_LENGTH} znaków.` : ""}
        </span>
        {value.length >= COUNTER_FROM ? (
          <span className={tooLong ? "text-status-negative" : "text-text-muted"}>
            {`${value.length}/${CHAT_MESSAGE_MAX_LENGTH}`}
          </span>
        ) : null}
      </div>
    </form>
  );
}
