// Model registry (ADR 002 §3.1). The only module that imports the OpenRouter provider package,
// so tests swap in mock models with `setModelsForTests`.
import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { getConfig } from "@/server/config/config";

export type ModelKind = "decision" | "chat";

// A type alias (not an interface) so it stays assignable to the SDK's JSON provider options.
export type ReasoningProviderOptions = {
  openrouter: { reasoning: { effort: string; exclude: true } };
};

let override: { vision: LanguageModelV4; decision: LanguageModelV4 } | undefined;
let provider: { apiKey: string; instance: ReturnType<typeof createOpenRouter> } | undefined;

function openrouter() {
  const { openrouterApiKey } = getConfig();
  if (provider?.apiKey !== openrouterApiKey) {
    provider = { apiKey: openrouterApiKey, instance: createOpenRouter({ apiKey: openrouterApiKey }) };
  }
  return provider.instance;
}

/** Replaces both models (tests only). */
export function setModelsForTests(models: { vision: LanguageModelV4; decision: LanguageModelV4 }): void {
  override = models;
}

export function resetModels(): void {
  override = undefined;
  provider = undefined;
}

// `usage.include` makes OpenRouter report the cost in `providerMetadata.openrouter.usage.cost`
// (T01b notes Q7), which the eval budget relies on.
export function visionModel(): LanguageModelV4 {
  if (override) return override.vision;
  return openrouter().chat(getConfig().visionModel, { usage: { include: true } });
}

export function decisionModel(): LanguageModelV4 {
  if (override) return override.decision;
  return openrouter().chat(getConfig().decisionModel, { usage: { include: true } });
}

/** Per-call provider options. Reasoning is never returned to us (`exclude: true`, TAC-002-05). */
export function reasoningOptions(kind: ModelKind): ReasoningProviderOptions {
  const config = getConfig();
  const effort = kind === "decision" ? config.decisionReasoningEffort : config.chatReasoningEffort;
  return { openrouter: { reasoning: { effort, exclude: true } } };
}
