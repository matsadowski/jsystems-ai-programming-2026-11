import "server-only";
import path from "node:path";
import { z } from "zod";
import { DECISION_MODES } from "@/lib/shared/enums";
import { ConfigError } from "@/server/http/errors";
import { logger } from "@/server/log/logger";

const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
const str = z.string().min(1);
const int = (def: number) => z.coerce.number().int().positive().default(def);

const envSchema = z.object({
  OPENROUTER_API_KEY: str,
  VISION_MODEL: str,
  DECISION_MODEL: str,
  DECISION_REASONING_EFFORT: z.enum(EFFORTS).default("medium"),
  CHAT_REASONING_EFFORT: z.enum(EFFORTS).default("low"),
  POLICY_DIR: str.default("../docs/policies"),
  CASE_TTL_MINUTES: int(120),
  CASE_STORE_MAX: int(200),
  APP_TIMEZONE: str.default("Europe/Warsaw"),
  DECISION_MODE: z.enum(DECISION_MODES).default("shadow"),
  LUNA_MODEL: str.default("openai/gpt-6-luna-decisions"),
  LUNA_CONFIDENCE_THRESHOLD: z.coerce.number().min(0.5).max(0.99).default(0.8),
  LUNA_TIMEOUT_MS: int(5000),
  EVAL_MAX_COST_USD: z.coerce.number().positive().default(5),
});

export interface AppConfig {
  openrouterApiKey: string;
  visionModel: string;
  decisionModel: string;
  decisionReasoningEffort: (typeof EFFORTS)[number];
  chatReasoningEffort: (typeof EFFORTS)[number];
  policyDir: string;
  caseTtlMinutes: number;
  caseStoreMax: number;
  appTimezone: string;
  decisionMode: (typeof DECISION_MODES)[number];
  lunaModel: string;
  lunaConfidenceThreshold: number;
  lunaTimeoutMs: number;
  evalMaxCostUsd: number;
}

let cached: AppConfig | undefined;

export function resetConfigCache(): void {
  cached = undefined;
}

function parse(env: Record<string, string | undefined>): AppConfig {
  // Empty strings count as missing.
  const cleaned: Record<string, string> = {};
  for (const key of Object.keys(envSchema.shape)) {
    const v = env[key];
    if (v !== undefined && v !== "") cleaned[key] = v;
  }
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    const detail = `Invalid or missing environment variables: ${names.join(", ")}`;
    logger.error("config_error", { detail });
    throw new ConfigError({ detail });
  }
  const e = result.data;
  return {
    openrouterApiKey: e.OPENROUTER_API_KEY,
    visionModel: e.VISION_MODEL,
    decisionModel: e.DECISION_MODEL,
    decisionReasoningEffort: e.DECISION_REASONING_EFFORT,
    chatReasoningEffort: e.CHAT_REASONING_EFFORT,
    policyDir: path.resolve(process.cwd(), e.POLICY_DIR),
    caseTtlMinutes: e.CASE_TTL_MINUTES,
    caseStoreMax: e.CASE_STORE_MAX,
    appTimezone: e.APP_TIMEZONE,
    decisionMode: e.DECISION_MODE,
    lunaModel: e.LUNA_MODEL,
    lunaConfidenceThreshold: e.LUNA_CONFIDENCE_THRESHOLD,
    lunaTimeoutMs: e.LUNA_TIMEOUT_MS,
    evalMaxCostUsd: e.EVAL_MAX_COST_USD,
  };
}

export function getConfig(env?: Record<string, string | undefined>): AppConfig {
  if (env) return parse(env);
  cached ??= parse(process.env);
  return cached;
}
