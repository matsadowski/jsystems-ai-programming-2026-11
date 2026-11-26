import { DecisionChangeNotice } from "./DecisionChangeNotice";
import { isReviseToolPart, successfulRevision } from "./chat-decision";
import { Markdown } from "./Markdown";
import type { ChatMessage } from "./MessageList";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser ? "bg-brand-primary text-text-on-dark" : "bg-bg-default text-text-primary shadow-card"
        }`}
        data-role={message.role}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return isUser ? (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            ) : (
              <Markdown key={i}>{part.text}</Markdown>
            );
          }
          if (isReviseToolPart(part)) {
            const out = successfulRevision(part);
            if (!out) return null;
            return (
              <DecisionChangeNotice key={i} fromLabel={out.fromLabel} toLabel={out.toLabel} reason={part.input?.reason} />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg bg-bg-default px-4 py-3 text-sm text-text-muted shadow-card">Asystent pisze…</div>
    </div>
  );
}
