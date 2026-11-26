import { getCaseDeps } from "@/server/cases/deps";
import { decideCase } from "@/server/cases/services";
import { newRequestId } from "@/server/http/request-id";
import { jsonResponse, toErrorResponse } from "@/server/http/responses";
import { logger } from "@/server/log/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
): Promise<Response> {
  const requestId = newRequestId();
  try {
    const { caseId } = await context.params;
    logger.info("decide_case_request", { requestId, caseIdLength: caseId.length });
    return jsonResponse(await decideCase(getCaseDeps(), caseId, request.signal), 200, requestId);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
