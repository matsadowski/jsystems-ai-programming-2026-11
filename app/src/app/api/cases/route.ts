import { getCaseDeps } from "@/server/cases/deps";
import { createCaseWithAnalysis } from "@/server/cases/services";
import { parseCaseForm } from "@/server/http/parse-case-form";
import { newRequestId } from "@/server/http/request-id";
import { jsonResponse, toErrorResponse } from "@/server/http/responses";
import { logger } from "@/server/log/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const requestId = newRequestId();
  try {
    const deps = getCaseDeps();
    const { fields, photo } = await parseCaseForm(request);
    logger.info("create_case_request", { requestId, photoBytes: photo.size });
    return jsonResponse(await createCaseWithAnalysis(deps, fields, photo, request.signal), 201, requestId);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
