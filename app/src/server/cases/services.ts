// Case use cases (ADR 001 §3.1, §5.1–5.2; ADR 004 §5). The AI, Luna and id steps are injected, so
// everything here runs without a key. Logs carry ids, lengths and counts only: never reason text
// or photo bytes (TAC-001-05).
import "server-only";
import { toFieldErrors, makeCaseInputSchema } from "@/lib/shared/case-input";
import { todayInZone } from "@/lib/shared/dates";
import type { CreateCaseResponse, DecideCaseResponse } from "@/lib/shared/api";
import { firstMessageUIMessage, renderFirstMessage } from "@/server/ai/render-first-message";
import { routeAnalysis, routeDecision, type RouterDeps } from "@/server/decisions/router";
import {
  computeDecisionFacts,
  type AnalyzeImage,
  type AssessWithLuna,
  type Case,
  type CaseRepository,
  type Clock,
  type DecideWithLlm,
  type DecisionMode,
} from "@/server/domain";
import { CaseNotFoundError, ValidationError } from "@/server/http/errors";
import { processPhoto } from "@/server/image";
import { logger } from "@/server/log/logger";
import { getPolicy } from "@/server/policies/policies";
import {
  toAnalysisDTO,
  toAssessmentDTO,
  toCaseSummary,
  toDecisionDTO,
  toTextUIMessage,
} from "./mappers";

export interface CaseServiceConfig {
  appTimezone: string;
  decisionMode: DecisionMode;
  lunaConfidenceThreshold: number;
  lunaTimeoutMs: number;
  policyDir: string;
}

export interface CaseServiceDeps {
  repo: CaseRepository;
  clock: Clock;
  config: CaseServiceConfig;
  /** Prompt version strings stored on every case (ADR 002 §3.2). */
  promptVersions: { vision: string; decision: string; chat: string };
  analyzeImage: AnalyzeImage;
  assessWithLuna: AssessWithLuna;
  decideWithLlm: DecideWithLlm;
  newId: () => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Router deps; a request abort signal is injected into the vision and decision ports. */
function routerDeps(deps: CaseServiceDeps, signal?: AbortSignal): RouterDeps {
  const withSignal = <A extends { signal?: AbortSignal }>(args: A): A => (signal ? { ...args, signal } : args);
  return {
    mode: deps.config.decisionMode,
    threshold: deps.config.lunaConfidenceThreshold,
    lunaTimeoutMs: deps.config.lunaTimeoutMs,
    analyzeImage: (args) => deps.analyzeImage(withSignal(args)),
    assessWithLuna: deps.assessWithLuna,
    decideWithLlm: (args) => deps.decideWithLlm(withSignal(args)),
  };
}

/** POST /api/cases: validate -> process photo -> facts -> route -> store. No case on any error. */
export async function createCaseWithAnalysis(
  deps: CaseServiceDeps,
  fields: Record<string, string>,
  photo: File,
  signal?: AbortSignal,
): Promise<CreateCaseResponse> {
  const now = deps.clock.now();
  const parsed = makeCaseInputSchema(todayInZone(now, deps.config.appTimezone)).safeParse(fields);
  if (!parsed.success) throw new ValidationError(toFieldErrors(parsed.error));
  const input = parsed.data;

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const image = await processPhoto({ bytes, declaredByteSize: photo.size });

  const facts = computeDecisionFacts(input.caseType, input.purchaseDate, todayInZone(now, deps.config.appTimezone));
  const caseId = deps.newId();
  const routed = await routeAnalysis(routerDeps(deps, signal), { caseId, input, image, facts });
  const policy = getPolicy(input.caseType, deps.config.policyDir);

  const iso = now.toISOString();
  const created: Case = {
    id: caseId,
    status: "ANALYZED",
    input,
    imageMeta: {
      originalFormat: image.originalFormat,
      originalWidth: image.originalWidth,
      originalHeight: image.originalHeight,
      originalByteSize: image.originalByteSize,
      width: image.width,
      height: image.height,
      byteSize: image.byteSize,
    },
    analysis: routed.analysis,
    facts,
    decision: null,
    decisionHistory: [],
    messages: [],
    policyVersion: policy.version,
    promptVersions: deps.promptVersions,
    decisionPath: routed.decisionPath,
    lunaAssessment: routed.lunaAssessment,
    shadow: routed.shadowFast ? { fastDecision: routed.shadowFast, agreesWithLlm: null } : null,
    chatInProgress: false,
    chatStartedAt: null,
    createdAt: iso,
    lastAccessAt: iso,
  };
  deps.repo.create(created);
  logger.info("case_created", {
    caseId,
    decisionPath: created.decisionPath,
    photoBytes: image.originalByteSize,
    reasonLength: input.reason.length,
  });
  if (routed.shadowFast && routed.lunaAssessment) {
    logger.info("luna_shadow", {
      caseId,
      shadowFast: routed.shadowFast,
      uncertainKeys: routed.lunaAssessment.uncertainKeys,
      latencyMs: routed.lunaAssessment.latencyMs,
      costUsd: routed.lunaAssessment.costUsd,
    });
  }

  return {
    caseId,
    caseSummary: toCaseSummary(created),
    analysis: toAnalysisDTO(created),
    decisionPath: created.decisionPath,
    assessment: toAssessmentDTO(created),
  };
}

function toDecideResponse(c: Case): DecideCaseResponse {
  const first = c.messages[0];
  if (!first) throw new Error("Decided case has no first message");
  return { decision: toDecisionDTO(c), firstMessage: toTextUIMessage(first) as DecideCaseResponse["firstMessage"] };
}

/** In-flight decides by case id: a concurrent call awaits the first instead of calling the model again. */
const inFlightDecisions = new Map<string, Promise<DecideCaseResponse>>();

/** POST /api/cases/{id}/decision. Idempotent once DECIDED; on error the case stays ANALYZED. */
export async function decideCase(
  deps: CaseServiceDeps,
  caseId: string,
  signal?: AbortSignal,
): Promise<DecideCaseResponse> {
  if (!UUID.test(caseId)) throw new ValidationError({ caseId: "Nieprawidłowy identyfikator zgłoszenia" });
  const existing = deps.repo.get(caseId);
  if (!existing) throw new CaseNotFoundError();
  if (existing.status === "DECIDED" && existing.decision) return toDecideResponse(existing);

  const running = inFlightDecisions.get(caseId);
  if (running) return running;
  const promise = runDecision(deps, caseId, existing, signal);
  inFlightDecisions.set(caseId, promise);
  try {
    return await promise;
  } finally {
    inFlightDecisions.delete(caseId);
  }
}

async function runDecision(
  deps: CaseServiceDeps,
  caseId: string,
  existing: Case,
  signal?: AbortSignal,
): Promise<DecideCaseResponse> {
  const { decision, shadow } = await routeDecision(routerDeps(deps, signal), existing);
  const markdown = renderFirstMessage({
    caseType: existing.input.caseType,
    category: existing.input.category,
    model: existing.input.model,
    purchaseDate: existing.input.purchaseDate,
    facts: existing.facts,
    decision,
  });
  const firstMessage = firstMessageUIMessage(deps.newId(), markdown);
  const at = deps.clock.now().toISOString();

  let committed = false;
  const updated = deps.repo.update(caseId, (c) => {
    // Another writer decided while the model ran: keep its result (messages, history) untouched.
    if (c.status === "DECIDED" && c.decision) return c;
    committed = true;
    return {
      ...c,
      status: "DECIDED",
      decision,
      decisionHistory: [...c.decisionHistory, { decision, at, trigger: "INITIAL" }],
      messages: [firstMessage],
      shadow: shadow ?? c.shadow,
    };
  });
  if (!updated) throw new CaseNotFoundError();
  if (committed) {
    logger.info("case_decided", {
      caseId,
      decisionPath: updated.decisionPath,
      decision: decision.decision,
      source: decision.source,
      ...(updated.shadow
        ? { shadowFast: updated.shadow.fastDecision, agreesWithLlm: updated.shadow.agreesWithLlm }
        : {}),
    });
  }
  return toDecideResponse(updated);
}
