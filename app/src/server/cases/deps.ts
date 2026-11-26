// Composition root of the case services (part a). Repo, clock and config come from the real
// modules; the three AI ports are NOT wired yet: the RULES path works, the LLM path fails
// cleanly with AI_UNAVAILABLE until T12b plugs in the analyst, decider and Luna.
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getConfig } from "@/server/config/config";
import { systemClock } from "@/server/domain";
import { AiUnavailableError } from "@/server/http/errors";
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

const notWired = async (): Promise<never> => {
  throw new AiUnavailableError({ detail: "AI pipeline not wired (T12b)" });
};

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
      vision: promptVersion("vision-return"),
      decision: promptVersion("decision-return"),
      chat: promptVersion("chat-system"),
    },
    analyzeImage: notWired,
    assessWithLuna: notWired,
    decideWithLlm: notWired,
    newId: () => crypto.randomUUID(),
  };
}
