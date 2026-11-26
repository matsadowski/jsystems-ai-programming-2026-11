// Chat transport: sends only `{ caseId, message }` (ADR 003 §3.4, §6.2; TAC-003-02).
import { DefaultChatTransport } from "ai";

export function buildChatRequestBody<M>(caseId: string, messages: M[]): { caseId: string; message: M } {
  return { caseId, message: messages[messages.length - 1] };
}

export function createChatTransport(caseId: string) {
  return new DefaultChatTransport({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: buildChatRequestBody(caseId, messages),
    }),
  });
}
