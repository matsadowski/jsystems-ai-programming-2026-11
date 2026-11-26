// Composition root of the case services. Repo, clock, config and the AI ports come from the real
// modules. The Luna port is built from `callLuna` + `buildQuestions` + `assess`; it is only called
// in `shadow` and `gated` modes (the default `.env.example` mode is `llm_only`).
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeImage } from "@/server/ai/analyst";
import { decideWithLlm } from "@/server/ai/decision";
import { getConfig, type AppConfig } from "@/server/config/config";
import { assess } from "@/server/decisions/certainty";
import { callLuna } from "@/server/decisions/luna-client";
import { buildQuestions, buildStateText, QUESTIONS_VERSION } from "@/server/decisions/questions";
import { systemClock, type AssessWithLuna } from "@/server/domain";
import { getCaseRepository } from "@/server/store";
import type { CaseServiceDeps } from "./services";

let override: CaseServiceDeps | null = null;

/** Test seam: route tests inject deps; `null` restores the real wiring. */
export function setCaseDepsForTests(deps: CaseServiceDeps | null): void {
  override = deps;
}

function promptVersion(name: string): string {
  const file = path.join(process.cwd(), "src/server/ai/prompts", `${name}.md`);
  return /^version:\s*(\S+)/.exec(readFileSync(file, "utf8"))?.[1] ?? "unknown";
}

/** Both case types' versions: the case record stores one string per step (ADR 002 §3.2). */
const bothTypes = (step: "vision" | "decision") =>
  `${promptVersion(`${step}-return`)} | ${promptVersion(`${step}-complaint`)}`;

/** Luna Decisions call + certainty assessment (ADR 004 §3.3, §4.2). Throws LunaUnavailableError. */
export function createAssessWithLuna(
  config: Pick<AppConfig, "lunaConfidenceThreshold" | "lunaTimeoutMs">,
  call: typeof callLuna = callLuna,
): AssessWithLuna {
  return async ({ caseId, input, image }) => {
    const result = await call({
      caseId,
      questions: buildQuestions(input.caseType, input.category, input.model),
      stateText: buildStateText({
        caseType: input.caseType,
        category: input.category,
        model: input.model,
        reason: input.reason,
      }),
      imageJpeg: image.bytes,
      timeoutMs: config.lunaTimeoutMs,
    });
    const assessment = assess(result.answers, config.lunaConfidenceThreshold);
    return {
      questionsVersion: QUESTIONS_VERSION,
      answers: result.answers,
      uncertainKeys: assessment.uncertainKeys,
      refusedKeys: assessment.refusedKeys,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
    };
  };
}

/** Throws ConfigError (503 CONFIG_ERROR) when the environment is incomplete. */
export function getCaseDeps(): CaseServiceDeps {
  if (override) return override;
  const config = getConfig();
  return {
    repo: getCaseRepository({ ttlMinutes: config.caseTtlMinutes, maxCases: config.caseStoreMax }),
    clock: systemClock,
    config: {
      appTimezone: config.appTimezone,
      decisionMode: config.decisionMode,
      lunaConfidenceThreshold: config.lunaConfidenceThreshold,
      lunaTimeoutMs: config.lunaTimeoutMs,
      policyDir: config.policyDir,
    },
    promptVersions: {
      vision: bothTypes("vision"),
      decision: bothTypes("decision"),
      chat: promptVersion("chat-system"),
    },
    analyzeImage,
    assessWithLuna: createAssessWithLuna(config),
    decideWithLlm,
    newId: () => crypto.randomUUID(),
  };
}
