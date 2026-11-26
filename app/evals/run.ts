// Eval runner (ADR 002 section 6.3, T20b): npm run eval -- [--runs N] [--only targeted|matrix|<case-id>] [--luna]
// Runs the real pipeline in-process (processPhoto -> analyzeImage -> facts -> routeAnalysis ->
// routeDecision in llm_only mode; chatStream for chat cases) against OpenRouter, within
// EVAL_MAX_COST_USD. Reads app/.env at runtime and never prints environment values.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { todayInZone } from "../src/lib/shared/dates";
import { analyzeImage, VISION_BUDGET_MS } from "../src/server/ai/analyst";
import { chatStream } from "../src/server/ai/chat";
import { decideWithLlm, DECISION_BUDGET_MS } from "../src/server/ai/decision";
import { getCaseDeps } from "../src/server/cases/deps";
import { getConfig } from "../src/server/config/config";
import { routeAnalysis, routeDecision, type RouterDeps } from "../src/server/decisions/router";
import { computeDecisionFacts, type Case, type Decision, type ImageAnalysis, type ImageMeta } from "../src/server/domain";
import { AppError } from "../src/server/http/errors";
import { processPhoto } from "../src/server/image";
import { getPolicy } from "../src/server/policies/policies";
import { InMemoryCaseRepository } from "../src/server/store/in-memory-case-repository";
import { buildMatrix, buildTargetedCases, type EvalCase } from "./cases";
import { agreementByCell } from "./lib/agreement";
import { createBudget, type Budget } from "./lib/budget";
import { checkInvariants, fallbackRate, type InvariantFailure } from "./lib/invariants";
import { renderReport } from "./lib/report";
import { percentile } from "./lib/stats";
import {
  EvalArgsError,
  buildAnalyzedCase,
  buildChatCase,
  evaluateTargeted,
  extractCostFromBody,
  parseEvalArgs,
  runLabel,
  selectCases,
  toCaseRow,
  type RunResult,
} from "./run-lib";

const IMAGES_DIR = path.resolve(process.cwd(), "../assets/example-images");
const REPORT_DIR = path.resolve(process.cwd(), "evals/reports");
const FIRST_CALL_ESTIMATE_USD = 0.05;
const LUNA_MESSAGE = "Luna unavailable (provider outage, D9)";

class BudgetStop extends Error {}

// ---- cost metering: tap OpenRouter responses (covers retries and the corrective retry) ----------
const meter = { cost: 0, known: false, pending: [] as Promise<void>[] };
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await realFetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("openrouter.ai")) {
    const copy = res.clone();
    meter.pending.push(
      copy.text().then(
        (body) => {
          const cost = extractCostFromBody(body);
          if (cost !== null) {
            meter.cost += cost;
            meter.known = true;
          }
        },
        () => undefined,
      ),
    );
  }
  return res;
}) as typeof fetch;

let budget: Budget; // created in main() once the env file is loaded (EVAL_MAX_COST_USD)
const reportedCosts: number[] = [];

/** Runs one model step under the budget; returns its result, latency and (known) cost. */
async function metered<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number; cost: number | null }> {
  const estimate = reportedCosts.length ? reportedCosts.reduce((a, b) => a + b, 0) / reportedCosts.length : FIRST_CALL_ESTIMATE_USD;
  if (!budget.canSpend(estimate)) throw new BudgetStop(budget.stopReason ?? "budget");
  meter.cost = 0;
  meter.known = false;
  const started = Date.now();
  let failure: unknown;
  let value: T | undefined;
  try {
    value = await fn();
  } catch (error) {
    failure = error;
  }
  const ms = Date.now() - started;
  await Promise.all(meter.pending.splice(0));
  const cost = meter.known ? meter.cost : null;
  budget.record(cost);
  if (cost !== null) reportedCosts.push(cost);
  if (failure !== undefined) throw Object.assign(failure instanceof Error ? failure : new Error(String(failure)), { stepMs: ms, stepCost: cost });
  return { value: value as T, ms, cost };
}

// ---- pipeline -----------------------------------------------------------------------------------
interface PipelineOutcome {
  result: RunResult;
  decision: Decision | null;
  analysis: ImageAnalysis | null;
  imageMeta: ImageMeta | null;
}

const errorCode = (e: unknown) => (e instanceof AppError ? e.code : e instanceof Error ? e.name : "UNKNOWN");
const sum = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));

let setup: { today: string; deps: ReturnType<typeof getCaseDeps>; policyDir: string };

async function runPipeline(c: EvalCase, run: number): Promise<PipelineOutcome> {
  const started = Date.now();
  const result: RunResult = {
    caseId: c.id, run, decision: null, decisionSource: null, citedClauses: [], justification: [], nextSteps: [],
    matchesDeclaredCategory: null, latencyMs: 0, costUsd: null, stepLatencyMs: {},
  };
  const out: PipelineOutcome = { result, decision: null, analysis: null, imageMeta: null };
  try {
    const bytes = new Uint8Array(readFileSync(path.join(IMAGES_DIR, c.imageFile)));
    const image = await processPhoto({ bytes, declaredByteSize: bytes.byteLength });
    const facts = computeDecisionFacts(c.caseType, c.purchaseDate, setup.today);
    const input = { caseType: c.caseType, category: c.category, model: c.model, purchaseDate: c.purchaseDate, reason: c.reason };
    const caseId = crypto.randomUUID();
    const deps: RouterDeps = {
      mode: "llm_only",
      threshold: 0.8,
      lunaTimeoutMs: 1,
      assessWithLuna: async () => {
        throw new Error(LUNA_MESSAGE);
      },
      analyzeImage: async (args) => {
        try {
          const step = await metered(() => analyzeImage(args));
          result.stepLatencyMs!.vision = step.ms;
          result.costUsd = sum(result.costUsd, step.cost);
          return step.value;
        } catch (e) {
          const t = e as { stepMs?: number; stepCost?: number | null };
          if (t.stepMs !== undefined) result.stepLatencyMs!.vision = t.stepMs;
          result.costUsd = sum(result.costUsd, t.stepCost ?? null);
          throw e;
        }
      },
      decideWithLlm: async (args) => {
        try {
          const step = await metered(() => decideWithLlm(args));
          result.stepLatencyMs!.decision = step.ms;
          result.costUsd = sum(result.costUsd, step.cost);
          return step.value;
        } catch (e) {
          const t = e as { stepMs?: number; stepCost?: number | null };
          if (t.stepMs !== undefined) result.stepLatencyMs!.decision = t.stepMs;
          result.costUsd = sum(result.costUsd, t.stepCost ?? null);
          throw e;
        }
      },
    };
    const routed = await routeAnalysis(deps, { caseId, input, image, facts });
    const imageMeta: ImageMeta = {
      originalFormat: image.originalFormat, originalWidth: image.originalWidth, originalHeight: image.originalHeight,
      originalByteSize: image.originalByteSize, width: image.width, height: image.height, byteSize: image.byteSize,
    };
    const analyzed: Case = {
      ...buildAnalyzedCase({
        evalCase: c, id: caseId, nowIso: new Date().toISOString(), today: setup.today, analysis: routed.analysis,
        imageMeta, policyVersion: getPolicy(c.caseType, setup.policyDir).version, promptVersions: setup.deps.promptVersions,
      }),
      decisionPath: routed.decisionPath,
    };
    const { decision } = await routeDecision(deps, analyzed);
    out.decision = decision;
    out.analysis = routed.analysis;
    out.imageMeta = imageMeta;
    result.decision = decision.decision;
    result.decisionSource = decision.source;
    result.citedClauses = decision.citedClauses;
    result.justification = decision.justification;
    result.nextSteps = decision.nextSteps;
    result.matchesDeclaredCategory = routed.analysis?.matchesDeclaredCategory ?? null;
  } catch (e) {
    if (e instanceof BudgetStop) throw e;
    result.error = errorCode(e);
  }
  result.latencyMs = Date.now() - started;
  return out;
}

/** Pipeline runs are shared between cases with identical inputs (injection control and the chat cases). */
const pipelineMemo = new Map<string, PipelineOutcome>();
async function pipelineFor(c: EvalCase, run: number): Promise<{ outcome: PipelineOutcome; shared: boolean }> {
  const key = [c.imageFile, c.caseType, c.category, c.purchaseDate, c.reason, run].join("|");
  const hit = pipelineMemo.get(key);
  if (hit) return { outcome: hit, shared: true };
  const outcome = await runPipeline(c, run);
  pipelineMemo.set(key, outcome);
  return { outcome, shared: false };
}

async function runChat(c: EvalCase, run: number): Promise<RunResult> {
  const { outcome, shared } = await pipelineFor(c, run);
  const base = outcome.result;
  const result: RunResult = {
    ...base, caseId: c.id, run, costUsd: shared ? 0 : base.costUsd, latencyMs: 0, stepLatencyMs: { ...base.stepLatencyMs },
  };
  if (!outcome.decision || !outcome.imageMeta) {
    result.error = base.error ?? "NO_DECISION";
    return result;
  }
  const clock = { now: () => new Date() };
  const repo = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 10, clock });
  const chatCase = buildChatCase({
    evalCase: c, id: crypto.randomUUID(), nowIso: clock.now().toISOString(), today: setup.today, decision: outcome.decision,
    analysis: outcome.analysis, imageMeta: outcome.imageMeta, policyVersion: getPolicy(c.caseType, setup.policyDir).version,
    promptVersions: setup.deps.promptVersions,
  });
  repo.create(chatCase);
  const userMessage = { id: crypto.randomUUID(), role: "user" as const, parts: [{ type: "text" as const, text: c.chatMessage ?? "" }] };
  const text: string[] = [];
  const toolCalls: string[] = [];
  let streamError: string | undefined;
  try {
    const step = await metered(async () => {
      const streamed = await chatStream(chatCase, {
        repo, clock, userMessage, onError: (e) => { streamError = errorCode(e); },
      });
      for await (const part of streamed.fullStream) {
        if (part.type === "text-delta") text.push(part.text);
        else if (part.type === "tool-call") toolCalls.push(part.toolName);
      }
    });
    result.latencyMs = step.ms;
    result.stepLatencyMs!.chat = step.ms;
    result.costUsd = sum(result.costUsd, step.cost);
  } catch (e) {
    if (e instanceof BudgetStop) throw e;
    result.error = errorCode(e);
    result.latencyMs = (e as { stepMs?: number }).stepMs ?? 0;
  }
  if (streamError && !result.error) result.error = streamError;
  result.chat = { text: text.join(""), toolCalls };
  return result;
}

// ---- main ---------------------------------------------------------------------------------------
async function main() {
  const args = parseEvalArgs(process.argv.slice(2));
  process.loadEnvFile?.(".env");
  if (args.luna) console.log(`--luna ignored: ${LUNA_MESSAGE}. Luna is not called.`);
  const config = getConfig();
  setup = { today: todayInZone(new Date(), config.appTimezone), deps: getCaseDeps(), policyDir: config.policyDir };
  const maxUsd = config.evalMaxCostUsd;
  budget = createBudget(maxUsd);

  const selection = selectCases(buildMatrix(setup.today), buildTargetedCases(setup.today), args.only);
  const runsByCase = new Map<string, RunResult[]>();
  const invariantFailures: { caseId: string; run: number; failures: InvariantFailure[] }[] = [];
  const order = [...selection.targeted, ...selection.matrix];
  console.log(`Eval: ${order.length} cases x ${args.runs} runs, models ${config.visionModel} / ${config.decisionModel}, budget $${maxUsd}`);

  const record = (c: EvalCase, r: RunResult) => {
    const list = runsByCase.get(c.id) ?? [];
    list.push(r);
    runsByCase.set(c.id, list);
    if (c.kind !== "chat" && r.decision !== null) {
      const failures = checkInvariants({
        caseType: c.caseType,
        decision: { decision: r.decision, citedClauses: r.citedClauses, justification: r.justification, nextSteps: r.nextSteps },
        clauseIds: getPolicy(c.caseType, setup.policyDir).clauseIds,
        latencyMs: r.latencyMs,
        budgetMs: VISION_BUDGET_MS + DECISION_BUDGET_MS,
      });
      if (failures.length) invariantFailures.push({ caseId: c.id, run: r.run, failures });
    }
    console.log(`  ${c.id} run ${r.run}: ${runLabel(r)}${r.chat ? ` tools=[${r.chat.toolCalls.join(",")}]` : ""} ${r.latencyMs} ms cost ${r.costUsd === null ? "n/a" : `$${r.costUsd.toFixed(4)}`}`);
  };

  try {
    for (const c of order) {
      for (let run = 1; run <= args.runs; run++) {
        if (c.kind === "chat") record(c, await runChat(c, run));
        else {
          const { outcome, shared } = await pipelineFor(c, run);
          record(c, { ...outcome.result, caseId: c.id, run, costUsd: shared ? 0 : outcome.result.costUsd });
        }
      }
    }
  } catch (e) {
    if (!(e instanceof BudgetStop)) throw e;
    console.log(`Budget stop: ${e.message}`);
  }

  // ---- assertions, rows, report ----
  const assertions = new Map<string, { passed: boolean; detail: string }>();
  for (const c of selection.targeted) {
    if (!c.expectation) continue;
    const control = c.expectation.kind === "INJECTION" ? (runsByCase.get(c.expectation.controlCaseId) ?? []) : [];
    assertions.set(c.id, evaluateTargeted(c, runsByCase.get(c.id) ?? [], control));
  }
  const cases = order.map((c) => toCaseRow(c.id, runsByCase.get(c.id) ?? [], assertions.get(c.id)?.passed ?? null));
  const matrixRuns = selection.matrix.flatMap((c) => runsByCase.get(c.id) ?? []);
  const agreement = agreementByCell(matrixRuns.map((r) => ({ cellId: r.caseId, decision: runLabel(r) })));
  const modelRuns = [...runsByCase.values()].flat().filter((r) => r.decisionSource !== null && r.decisionSource !== "RULES");
  const uniqueModelRuns = [...new Map(modelRuns.map((r) => [`${r.caseId}|${r.run}`, r])).values()];
  const rate = fallbackRate(uniqueModelRuns.map((r) => ({ decisionSource: r.decisionSource! })));
  const invalidOutput = matrixRuns.filter((r) => r.error === "AI_INVALID_OUTPUT").length;

  const stepP50 = (step: "vision" | "decision" | "chat") =>
    percentile([...runsByCase.values()].flat().map((r) => r.stepLatencyMs?.[step]).filter((x): x is number => typeof x === "number"), 50);
  const policyVersion = `RETURN ${getPolicy("RETURN", setup.policyDir).version}, COMPLAINT ${getPolicy("COMPLAINT", setup.policyDir).version}`;
  const date = setup.today;
  let md = renderReport({
    runDate: date,
    models: { vision: config.visionModel, decision: config.decisionModel },
    promptVersions: setup.deps.promptVersions,
    policyVersion,
    budget,
    cases,
    invariantFailures,
    fallbackRate: rate,
    agreement,
  });
  md += [
    "## Targeted assertions", "",
    ...[...assertions].map(([id, a]) => `- ${id}: ${a.passed ? "PASS" : "FAIL"} (${a.detail})`),
    "",
    "## Other metrics", "",
    `- Fallback rate is over model-path runs (source MODEL or GUARDRAIL): ${uniqueModelRuns.length} runs.`,
    `- AI_INVALID_OUTPUT across the matrix: ${invalidOutput}/${matrixRuns.length} runs (TAC-002-04 limit 5%).`,
    `- p50 latency per step: vision ${stepP50("vision") ?? "n/a"} ms, decision ${stepP50("decision") ?? "n/a"} ms, chat ${stepP50("chat") ?? "n/a"} ms.`,
    "- Cost: OpenRouter usage.cost; for BYOK keys it reports 0, so the upstream inference cost is used instead. Cases sharing an identical pipeline (injection control and the chat cases) reuse one run; the reuse shows $0.",
    "- Runs per case may be below the requested count when the budget stopped the run.",
    "",
    "## Luna", "", LUNA_MESSAGE, "",
  ].join("\n");
  mkdirSync(REPORT_DIR, { recursive: true });
  const slug = config.decisionModel.replace(/[^a-z0-9.]+/gi, "-").toLowerCase();
  const file = path.join(REPORT_DIR, `${date}-${slug}.md`);
  writeFileSync(file, md);

  console.log("\n=== Summary ===");
  console.log(`Report: ${file}`);
  console.log(`Spent: $${budget.spent.toFixed(4)} of $${maxUsd}${budget.stopped ? ` (BUDGET STOP: ${budget.stopReason})` : ""}; unknown-cost calls: ${budget.unknownCostCalls}`);
  for (const [id, a] of assertions) console.log(`  ${a.passed ? "PASS" : "FAIL"} ${id}: ${a.detail}`);
  console.log(`Invariant failures: ${invariantFailures.length}; fallback rate ${Math.round(rate * 100)}%; AI_INVALID_OUTPUT ${invalidOutput}/${matrixRuns.length}`);
  for (const a of agreement) console.log(`  agreement ${a.cellId}: ${a.agreeing}/${a.runs} (${a.modalDecision}) ${a.meetsTarget ? "met" : "NOT met"}`);
}

main().catch((error) => {
  if (error instanceof EvalArgsError) console.error(error.message);
  else console.error("Eval failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
