// Decision router (ADR 004 §3.1–3.4, §4.3–4.6, §5, §7.1–7.2). Chooses the decision path.
// All dependencies are injected ports (`server/domain/ports.ts`); the router itself is pure
// apart from those calls and logging.
//
// Final signatures (two steps, matching the two endpoints):
//   routeAnalysis(deps: RouterDeps, args: { caseId, input, image, facts }): Promise<RoutedAnalysis>
//     Step 1 (POST /api/cases). The service stores `decisionPath`, `analysis`, `lunaAssessment`
//     on the case, keeps `preparedDecision` next to it, and stores `shadowFast` as
//     `case.shadow = { fastDecision: shadowFast, agreesWithLlm: null }` (shadow mode only).
//   routeDecision(deps, c: Case & { preparedDecision?: Decision | null }):
//     Promise<{ decision: Decision; shadow: ShadowComparison | null }>
//     Step 2 (POST /api/cases/{id}/decision). In shadow mode reads the fast result from
//     `c.shadow?.fastDecision` (missing → "UNCERTAIN").
import { logger } from "@/server/log/logger";
import { expiredWindowDecision } from "@/server/ai/guardrails";
import type { CaseInput } from "@/lib/shared/case-input";
import type { DecisionMode } from "@/lib/shared/enums";
import type {
  AnalyzeImage,
  AssessWithLuna,
  Case,
  DecideWithLlm,
  Decision,
  DecisionFacts,
  DecisionPath,
  ImageAnalysis,
  LunaAssessment,
  ProcessedImage,
  ShadowComparison,
  ShadowFastResult,
} from "@/server/domain";
import { assess } from "./certainty";
import { isFastPathEligible } from "./eligibility";
import { mapToDecision } from "./fast-path";

export interface RouterDeps {
  mode: DecisionMode;
  threshold: number;
  lunaTimeoutMs: number;
  analyzeImage: AnalyzeImage;
  assessWithLuna: AssessWithLuna;
  decideWithLlm: DecideWithLlm;
  /** Millisecond clock, for latency logging in tests. */
  now?: () => number;
}

export interface RoutedAnalysis {
  decisionPath: DecisionPath;
  analysis: ImageAnalysis | null;
  lunaAssessment: LunaAssessment | null;
  /** RULES/FAST: built now, returned by step 2. */
  preparedDecision: Decision | null;
  /** Shadow mode only. */
  shadowFast: ShadowFastResult | null;
}

export interface RouteAnalysisArgs {
  caseId: string;
  input: CaseInput;
  image: ProcessedImage;
  facts: DecisionFacts;
}

type FastOutcome =
  | { kind: "decision"; decision: Decision; assessment: LunaAssessment }
  | { kind: "uncertain"; assessment: LunaAssessment | null }
  | { kind: "unmapped"; assessment: LunaAssessment };

/** Certainty and mapping over a Luna assessment; fails closed on anything not fully certain. */
function fastOutcome(
  input: CaseInput,
  facts: DecisionFacts,
  luna: LunaAssessment | null,
  threshold: number,
): FastOutcome {
  if (!luna) return { kind: "uncertain", assessment: null };
  const a = assess(luna.answers, threshold);
  const assessment: LunaAssessment = { ...luna, uncertainKeys: a.uncertainKeys, refusedKeys: a.refusedKeys };
  if (!a.allCertain) return { kind: "uncertain", assessment };
  const mapped = mapToDecision(input.caseType, facts, luna.answers);
  if (mapped === "UNMAPPED") return { kind: "unmapped", assessment };
  return { kind: "decision", decision: mapped, assessment };
}

/** Luna call with timeout. Never rejects: returns null on error or timeout (logged). */
async function callLuna(deps: RouterDeps, args: RouteAnalysisArgs): Promise<LunaAssessment | null> {
  const now = deps.now ?? Date.now;
  const started = now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Luna timed out after ${deps.lunaTimeoutMs} ms`));
    }, deps.lunaTimeoutMs);
  });
  try {
    return await Promise.race([
      deps.assessWithLuna({ caseId: args.caseId, input: args.input, image: args.image, signal: controller.signal }),
      timeout,
    ]);
  } catch (error) {
    logger.warn("luna_unavailable", { mode: deps.mode, elapsedMs: now() - started, error });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const NON_DECISIONS: readonly ShadowFastResult[] = ["UNMAPPED", "NOT_ELIGIBLE", "UNCERTAIN"];

export async function routeAnalysis(deps: RouterDeps, args: RouteAnalysisArgs): Promise<RoutedAnalysis> {
  const { input, image, facts } = args;
  const analyze = () => deps.analyzeImage({ input, image });

  if (!facts.withinWindow) {
    return {
      decisionPath: "RULES",
      analysis: null,
      lunaAssessment: null,
      preparedDecision: expiredWindowDecision(input.caseType, facts, "RULES"),
      shadowFast: null,
    };
  }

  if (deps.mode === "llm_only") {
    return { decisionPath: "LLM", analysis: await analyze(), lunaAssessment: null, preparedDecision: null, shadowFast: null };
  }

  const eligible = isFastPathEligible(input.caseType, input.category, facts).eligible;

  if (deps.mode === "shadow") {
    const lunaPromise = callLuna(deps, args); // never rejects
    const analysis = await analyze();
    const luna = await lunaPromise;
    let shadowFast: ShadowFastResult;
    if (!eligible) shadowFast = "NOT_ELIGIBLE";
    else {
      const o = fastOutcome(input, facts, luna, deps.threshold);
      shadowFast = o.kind === "decision" ? o.decision.decision : o.kind === "unmapped" ? "UNMAPPED" : "UNCERTAIN";
    }
    return { decisionPath: "LLM", analysis, lunaAssessment: luna, preparedDecision: null, shadowFast };
  }

  // gated
  const luna = eligible ? await callLuna(deps, args) : null;
  const outcome = eligible ? fastOutcome(input, facts, luna, deps.threshold) : null;
  if (outcome?.kind === "decision") {
    return {
      decisionPath: "FAST",
      analysis: null,
      lunaAssessment: outcome.assessment,
      preparedDecision: outcome.decision,
      shadowFast: null,
    };
  }
  return {
    decisionPath: "LLM_ESCALATED",
    analysis: await analyze(),
    lunaAssessment: outcome?.assessment ?? null,
    preparedDecision: null,
    shadowFast: null,
  };
}

export async function routeDecision(
  deps: RouterDeps,
  c: Case & { preparedDecision?: Decision | null },
): Promise<{ decision: Decision; shadow: ShadowComparison | null }> {
  if (!c.facts.withinWindow || c.decisionPath === "RULES") {
    return { decision: expiredWindowDecision(c.input.caseType, c.facts, "RULES"), shadow: null };
  }

  if (c.decisionPath === "FAST") {
    // Re-validate: never return FAST unless every answer is certain and mapped (TAC-004-02).
    const o = fastOutcome(c.input, c.facts, c.lunaAssessment, deps.threshold);
    if (o.kind !== "decision") throw new Error("FAST path requires a certain, mapped Luna assessment");
    return { decision: c.preparedDecision ?? o.decision, shadow: null };
  }

  if (!c.analysis) throw new Error(`Path ${c.decisionPath} requires a stored image analysis`);
  const preliminary = c.decisionPath === "LLM_ESCALATED" && c.lunaAssessment ? c.lunaAssessment : undefined;
  const decision = await deps.decideWithLlm({
    input: c.input,
    analysis: c.analysis,
    facts: c.facts,
    ...(preliminary ? { preliminary } : {}),
  });

  if (deps.mode !== "shadow" || c.decisionPath !== "LLM") return { decision, shadow: null };
  const fastDecision = c.shadow?.fastDecision ?? "UNCERTAIN";
  const agreesWithLlm = NON_DECISIONS.includes(fastDecision) ? null : fastDecision === decision.decision;
  return { decision, shadow: { fastDecision, agreesWithLlm } };
}
