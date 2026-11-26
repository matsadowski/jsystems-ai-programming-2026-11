import { getCaseDeps } from "@/server/cases/deps";
import { ChatRequestSchema, startChatTurn } from "@/server/cases/chat-service";
import { parseJson } from "@/server/http/parse-json";
import { newRequestId } from "@/server/http/request-id";
import { toErrorResponse } from "@/server/http/responses";
import { logger } from "@/server/log/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const requestId = newRequestId();
  try {
    const body = await parseJson(request, ChatRequestSchema);
    logger.info("chat_request", { requestId, caseIdLength: body.caseId.length, messageLength: body.message.parts[0].text.length });
    return await startChatTurn(getCaseDeps(), body, {
      signal: request.signal,
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
