import { logger } from "@/server/log/logger";
import { AppError, errorBody, InternalError } from "./errors";

const HEADER = "x-request-id";

export function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", [HEADER]: requestId },
  });
}

export function toErrorResponse(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error("request_failed", {
        requestId,
        code: error.code,
        status: error.status,
        detail: error.detail,
        causeName: error.cause instanceof Error ? error.cause.name : error.cause === undefined ? undefined : typeof error.cause,
      });
    } else {
      logger.info("request_rejected", { requestId, code: error.code, status: error.status });
    }
    return jsonResponse(errorBody(error), error.status, requestId);
  }
  logger.error("unhandled_error", {
    requestId,
    errorName: error instanceof Error ? error.name : typeof error,
  });
  const internal = new InternalError();
  return jsonResponse(errorBody(internal), internal.status, requestId);
}
