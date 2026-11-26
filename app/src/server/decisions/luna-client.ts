// Plain `fetch` client for the OpenRouter Decisions API (ADR 004 §3.3, §7.3). The endpoint is
// alpha: the request `state` shape is unverified (T01b notes conflict 6), so it is isolated in
// `buildLunaRequestBody` and will be adjusted after the real capture (T11b).
import "server-only";
import { z } from "zod";
import { getConfig } from "@/server/config/config";
import { LunaUnavailableError } from "@/server/http/errors";
import { logger } from "@/server/log/logger";
import { toLunaAnswer } from "@/server/decisions/certainty";
import type { LunaAnswer } from "@/server/domain/case";
import type { LunaQuestion } from "@/server/decisions/questions";

export const LUNA_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";

export interface BuildLunaRequestArgs {
  model: string;
  stateText: string;
  imageJpeg: Buffer;
  questions: LunaQuestion[];
  caseId: string;
}

/** The only place that knows the request body shape. */
export function buildLunaRequestBody(args: BuildLunaRequestArgs): Record<string, unknown> {
  return {
    model: args.model,
    state: [
      args.stateText,
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${args.imageJpeg.toString("base64")}` } },
    ],
    questions: Object.fromEntries(
      args.questions.map((q) => [
        q.key,
        { type: q.type, instructions: q.instructions, ...(q.criteria ? { criteria: q.criteria } : {}) },
      ]),
    ),
    session_id: args.caseId,
  };
}

// Unknown fields are ignored. Individual answers are validated by `toLunaAnswer` (fails closed).
const ResponseSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  usage: z.object({ cost: z.number().nullish() }).optional(),
});

export interface CallLunaArgs {
  caseId: string;
  questions: LunaQuestion[];
  stateText: string;
  imageJpeg: Buffer;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export interface LunaResult {
  /** Parsed JSON body exactly as received. */
  raw: unknown;
  answers: LunaAnswer[];
  latencyMs: number;
  costUsd: number | null;
}

export async function callLuna(args: CallLunaArgs): Promise<LunaResult> {
  const { fetchImpl = fetch } = args;
  const config = getConfig();
  const body = buildLunaRequestBody({
    model: config.lunaModel,
    stateText: args.stateText,
    imageJpeg: args.imageJpeg,
    questions: args.questions,
    caseId: args.caseId,
  });
  const startedAt = Date.now();

  const fail = (reason: string, cause?: unknown, extra: Record<string, unknown> = {}): never => {
    logger.warn("luna_unavailable", { reason, latencyMs: Date.now() - startedAt, ...extra });
    throw new LunaUnavailableError(`Luna Decisions unavailable: ${reason}`, { cause });
  };

  let response: Response;
  try {
    response = await fetchImpl(LUNA_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openrouterApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(args.timeoutMs),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");
    return fail(timedOut ? "timeout" : "network_error", cause);
  }
  if (!response.ok) return fail("http_error", undefined, { status: response.status });

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (cause) {
    return fail("invalid_json", cause);
  }
  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) return fail("schema_mismatch", parsed.error);

  return {
    raw,
    answers: args.questions.map((q) => toLunaAnswer(q.key, parsed.data.answers[q.key])),
    latencyMs: Date.now() - startedAt,
    costUsd: parsed.data.usage?.cost ?? null,
  };
}
