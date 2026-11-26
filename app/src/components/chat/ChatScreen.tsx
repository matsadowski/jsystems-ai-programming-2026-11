"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { AnalysisDTO, AssessmentDTO, CaseSummary, DecisionDTO, TextUIMessage } from "@/lib/shared";
import { CaseSummaryPanel } from "./CaseSummaryPanel";
import { ChatInput } from "./ChatInput";
import { deriveDecision } from "./chat-decision";
import { createChatTransport } from "./chat-transport";
import { MessageList, type ChatMessage } from "./MessageList";

export interface ChatScreenProps {
  caseId: string;
  caseSummary: CaseSummary;
  analysis: AnalysisDTO | null;
  assessment: AssessmentDTO | null;
  decision: DecisionDTO;
  firstMessage: TextUIMessage;
  photoPreviewUrl: string | null;
  onNewCase: () => void;
}

export function ChatScreen({
  caseId,
  caseSummary,
  analysis,
  assessment,
  decision,
  firstMessage,
  photoPreviewUrl,
  onNewCase,
}: ChatScreenProps) {
  const [transport] = useState(() => createChatTransport(caseId));
  const { messages, sendMessage, regenerate, status, error } = useChat<ChatMessage>({
    id: caseId,
    messages: [firstMessage],
    transport,
  });

  // The current decision is derived from the initial one, early tool parts and finish metadata
  // (ADR 003 §6.3).
  const currentDecision = useMemo(
    () => deriveDecision(decision, caseSummary.caseType, messages),
    [decision, caseSummary.caseType, messages],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:h-[calc(100vh-5rem)] lg:flex-row">
      <h1 className="sr-only">Rozmowa o zgłoszeniu</h1>
      <aside className="w-full shrink-0 lg:w-80 lg:overflow-y-auto">
        <CaseSummaryPanel
          caseSummary={caseSummary}
          analysis={analysis}
          assessment={assessment}
          decision={currentDecision}
          photoPreviewUrl={photoPreviewUrl}
        />
      </aside>
      <section aria-label="Czat" className="flex min-h-[60vh] min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-bg-light shadow-card">
        <MessageList
          messages={messages}
          status={status}
          error={error}
          onRetry={() => void regenerate()}
          onNewCase={onNewCase}
        />
        <ChatInput
          disabled={status === "submitted" || status === "streaming"}
          onSend={(text) => void sendMessage({ text })}
        />
      </section>
    </div>
  );
}
