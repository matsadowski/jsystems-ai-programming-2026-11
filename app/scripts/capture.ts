// Real LLM capture script (ADR 002 §6.1, ADR 004 TAC-004-05, T11a).
//   npm run capture -- --step vision|decision|chat|luna --case <fixture-case> [--image <file>]
// Calls the real OpenRouter API with synthetic form data and a real example photo, and records the
// result at the language-model level (`wrapLanguageModel` middleware) so tests replay it exactly.
// Reads `app/.env` at runtime via `process.loadEnvFile`; never prints the key.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Output, generateText, isStepCount, streamText, tool, wrapLanguageModel } from "ai";
import type { LanguageModelMiddleware } from "ai";
import { todayInZone } from "../src/lib/shared/dates";
import { decisionLabel } from "../src/lib/shared/labels";
import { CATEGORY_LABELS } from "../src/lib/shared/labels";
import {
  ComplaintDecisionOutputSchema,
  ComplaintImageAnalysisSchema,
  ReturnDecisionOutputSchema,
  ReturnImageAnalysisSchema,
  ReviseDecisionInputSchema,
} from "../src/server/ai/schemas";
import { decisionModel, reasoningOptions, visionModel } from "../src/server/ai/models";
import { loadPrompt } from "../src/server/ai/prompts/load-prompt";
import { getConfig } from "../src/server/config/config";
import { callLuna } from "../src/server/decisions/luna-client";
import { buildQuestions, buildStateText, QUESTIONS_VERSION } from "../src/server/decisions/questions";
import { computeDecisionFacts } from "../src/server/domain/facts";
import type { CaseInput } from "../src/lib/shared/case-input";
import { AppError } from "../src/server/http/errors";
import { processPhoto } from "../src/server/image";
import { getPolicy } from "../src/server/policies/policies";
import {
  CaptureArgsError,
  FIXTURE_CASES,
  USAGE,
  buildMeta,
  isoDaysBefore,
  parseCaptureArgs,
  sanitizeRecorded,
  stripSecrets,
  type FixtureCase,
} from "./capture-lib";

const APP_DIR = process.cwd();
const CAPTURE_DIR = path.join(APP_DIR, "tests/fixtures/llm-captures");
const IMAGES_DIR = path.resolve(APP_DIR, "../assets/example-images");
const LUNA_HEADER_ALLOW = ["content-type", "x-generation-id"];

function packageVersion(name: string): string {
  const file = path.join(APP_DIR, "node_modules", name, "package.json");
  return (JSON.parse(readFileSync(file, "utf8")) as { version: string }).version;
}

function writeCapture(caseName: string, data: unknown, meta: unknown): void {
  mkdirSync(CAPTURE_DIR, { recursive: true });
  writeFileSync(path.join(CAPTURE_DIR, `${caseName}.json`), JSON.stringify(data, null, 2) + "\n");
  writeFileSync(path.join(CAPTURE_DIR, `${caseName}.meta.json`), JSON.stringify(meta, null, 2) + "\n");
  console.log(`wrote tests/fixtures/llm-captures/${caseName}.json (+ .meta.json)`);
}

function readCapture<T>(caseName: string): T {
  const file = path.join(CAPTURE_DIR, `${caseName}.json`);
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch (cause) {
    throw new Error(`Capture ${caseName}.json is required first: run its capture step before this one`, { cause });
  }
}

/** Recording middleware: stores every `doGenerate` result and every `doStream` part, in order. */
function recorder() {
  const generates: unknown[] = [];
  const streams: unknown[][] = [];
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      generates.push(result);
      return result;
    },
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      const parts: unknown[] = [];
      streams.push(parts);
      const tee = stream.pipeThrough(
        new TransformStream({
          transform(part, controller) {
            parts.push(part);
            controller.enqueue(part);
          },
        }),
      );
      return { stream: tee, ...rest };
    },
  };
  return { middleware, generates, streams };
}

interface Prepared {
  fixture: FixtureCase;
  input: CaseInput;
  imageFile: string;
  facts: ReturnType<typeof computeDecisionFacts>;
}

function prepare(caseName: string, imageOverride: string | undefined): Prepared {
  const fixture = FIXTURE_CASES[caseName];
  const config = getConfig();
  const today = todayInZone(new Date(), config.appTimezone);
  const purchaseDate = isoDaysBefore(today, fixture.daysAgo);
  const input: CaseInput = {
    caseType: fixture.caseType,
    category: fixture.category,
    model: fixture.model,
    purchaseDate,
    reason: fixture.reason,
  };
  return {
    fixture,
    input,
    imageFile: imageOverride ?? fixture.image,
    facts: computeDecisionFacts(fixture.caseType, purchaseDate, today),
  };
}

const loadImage = (file: string) => processPhoto({ bytes: readFileSync(path.join(IMAGES_DIR, file)) });

function caseFormText(input: CaseInput): string {
  return [
    `Case type: ${input.caseType}`,
    `Device category: ${CATEGORY_LABELS[input.category]}`,
    `Model: ${input.model}`,
    `Purchase date: ${input.purchaseDate}`,
  ].join("\n");
}

const factsText = (facts: Prepared["facts"]) => JSON.stringify(facts, null, 2);

function baseMeta(p: Prepared, caseName: string, step: FixtureCase["step"], target: string) {
  return {
    capturedAt: new Date(),
    target,
    step,
    caseName,
    caseType: p.input.caseType,
    category: p.input.category,
    imageFile: p.imageFile,
    packages: {
      ai: packageVersion("ai"),
      "@openrouter/ai-sdk-provider": packageVersion("@openrouter/ai-sdk-provider"),
    },
  } as const;
}

const analysisSchema = (t: Prepared["input"]["caseType"]) =>
  t === "RETURN" ? ReturnImageAnalysisSchema : ComplaintImageAnalysisSchema;
const decisionSchema = (t: Prepared["input"]["caseType"]) =>
  t === "RETURN" ? ReturnDecisionOutputSchema : ComplaintDecisionOutputSchema;

async function captureVision(caseName: string, imageOverride?: string) {
  const p = prepare(caseName, imageOverride);
  const config = getConfig();
  const image = await loadImage(p.imageFile);
  const name = p.input.caseType === "RETURN" ? "vision-return" : "vision-complaint";
  const prompt = loadPrompt(name, { case_form: caseFormText(p.input), employee_reason: p.input.reason });
  const rec = recorder();
  const model = wrapLanguageModel({ model: visionModel(), middleware: rec.middleware });
  const result = await generateText({
    model,
    instructions: prompt.text,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Analyse the attached photo and return the structured object." },
          { type: "file", mediaType: "image/jpeg", data: image.bytes },
        ],
      },
    ],
    output: Output.object({ schema: analysisSchema(p.input.caseType) }),
    temperature: 0,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(20_000),
  });
  console.log(`vision output keys: ${Object.keys(result.output as object).join(", ")}`);
  writeCapture(
    caseName,
    sanitizeRecorded(rec.generates.at(-1)),
    buildMeta({ ...baseMeta(p, caseName, "vision", config.visionModel), promptVersion: prompt.version }),
  );
}

function analysisOf(caseName: string, caseType: Prepared["input"]["caseType"]): unknown {
  const recorded = readCapture<{ content: { type: string; text?: string }[] }>(caseName);
  const text = recorded.content.find((c) => c.type === "text")?.text;
  if (!text) throw new Error(`Capture ${caseName} has no text content`);
  return analysisSchema(caseType).parse(JSON.parse(text));
}

async function captureDecision(caseName: string, imageOverride?: string) {
  const p = prepare(caseName, imageOverride);
  const config = getConfig();
  const policy = getPolicy(p.input.caseType, config.policyDir);
  const analysis = analysisOf(p.fixture.visionCase as string, p.input.caseType);
  const name = p.input.caseType === "RETURN" ? "decision-return" : "decision-complaint";
  const prompt = loadPrompt(name, {
    policy: policy.text,
    case_form: caseFormText(p.input),
    employee_reason: p.input.reason,
    facts: factsText(p.facts),
    image_analysis: JSON.stringify(analysis, null, 2),
    preliminary_assessment: "",
  });
  const rec = recorder();
  const model = wrapLanguageModel({ model: decisionModel(), middleware: rec.middleware });
  const result = await generateText({
    model,
    instructions: prompt.text,
    messages: [{ role: "user", content: "Give the decision for this case now." }],
    output: Output.object({ schema: decisionSchema(p.input.caseType) }),
    providerOptions: reasoningOptions("decision"),
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(35_000),
  });
  console.log(`decision: ${(result.output as { decision: string }).decision}`);
  writeCapture(
    caseName,
    sanitizeRecorded(rec.generates.at(-1)),
    buildMeta({
      ...baseMeta(p, caseName, "decision", config.decisionModel),
      promptVersion: prompt.version,
      policyVersion: policy.version,
    }),
  );
}

async function captureChat(caseName: string, imageOverride?: string) {
  const p = prepare(caseName, imageOverride);
  const config = getConfig();
  const policy = getPolicy(p.input.caseType, config.policyDir);
  const analysis = analysisOf(p.fixture.visionCase as string, p.input.caseType);
  const decisionRecorded = readCapture<{ content: { type: string; text?: string }[] }>(p.fixture.decisionCase as string);
  const decisionText = decisionRecorded.content.find((c) => c.type === "text")?.text ?? "{}";
  const decision = decisionSchema(p.input.caseType).parse(JSON.parse(decisionText));
  const context = [
    "Case form:",
    caseFormText(p.input),
    ...(p.input.reason ? [`Employee reason (unverified claim): ${p.input.reason}`] : []),
    "Facts:",
    factsText(p.facts),
    "Photo analysis:",
    JSON.stringify(analysis, null, 2),
    "Current decision:",
    JSON.stringify(decision, null, 2),
  ].join("\n");
  const prompt = loadPrompt("chat-system", { policy: policy.text, case_context: context });
  const rec = recorder();
  const model = wrapLanguageModel({ model: decisionModel(), middleware: rec.middleware });
  const caseType = p.input.caseType;
  // Stand-in for T12's real tool: fixed result, same shape as ADR 002 §4.5.
  const reviseDecision = tool({
    description:
      "Revise the recommended decision when the employee supplies a new fact that matters under the policy.",
    inputSchema: ReviseDecisionInputSchema,
    execute: async (args) => ({
      ok: true as const,
      from: decision.decision,
      to: args.newDecision,
      fromLabel: decisionLabel(caseType, decision.decision as never).label,
      toLabel: args.newDecision,
    }),
  });
  const result = streamText({
    model,
    instructions: prompt.text,
    messages: [{ role: "user", content: p.fixture.userMessage as string }],
    tools: { reviseDecision },
    stopWhen: isStepCount(3),
    providerOptions: reasoningOptions("chat"),
    maxRetries: 1,
    timeout: { firstChunkMs: 20_000, totalMs: 60_000 },
  });
  await result.consumeStream();
  console.log(`chat calls: ${rec.streams.length}, text length: ${(await result.text).length}`);
  const data = rec.streams.length === 1 ? rec.streams[0] : rec.streams;
  writeCapture(
    caseName,
    sanitizeRecorded(data),
    buildMeta({
      ...baseMeta(p, caseName, "chat", config.decisionModel),
      promptVersion: prompt.version,
      policyVersion: policy.version,
    }),
  );
}

async function captureLuna(caseName: string, imageOverride?: string) {
  const p = prepare(caseName, imageOverride);
  const config = getConfig();
  const image = await loadImage(p.imageFile);
  const questions = buildQuestions(p.input.caseType, p.input.category, p.input.model);
  const stateText = buildStateText({
    caseType: p.input.caseType,
    category: p.input.category,
    model: p.input.model,
    reason: p.input.reason,
  });
  let recorded: { status: number; headers: Record<string, string>; body: unknown } | undefined;
  const recordingFetch: typeof fetch = async (url, init) => {
    const res = await fetch(url, init);
    const text = await res.clone().text();
    const headers: Record<string, string> = {};
    for (const h of LUNA_HEADER_ALLOW) {
      const v = res.headers.get(h);
      if (v !== null) headers[h] = v;
    }
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep the raw text
    }
    recorded = { status: res.status, headers, body };
    return res;
  };
  let failure: unknown;
  try {
    await callLuna({
      caseId: `capture-${caseName}`,
      questions,
      stateText,
      imageJpeg: image.bytes,
      timeoutMs: Math.max(config.lunaTimeoutMs, 15_000),
      fetchImpl: recordingFetch,
    });
  } catch (e) {
    failure = e;
  }
  if (recorded) {
    writeCapture(
      caseName,
      sanitizeRecorded(recorded),
      buildMeta({
        ...baseMeta(p, caseName, "luna", "https://openrouter.ai/api/alpha/decisions"),
        questionsVersion: QUESTIONS_VERSION,
      }),
    );
    console.log(`luna HTTP status: ${recorded.status}`);
  }
  if (failure) throw failure;
}

const STEPS = { vision: captureVision, decision: captureDecision, chat: captureChat, luna: captureLuna };

async function main() {
  try {
    process.loadEnvFile?.(".env");
  } catch {
    // no .env: configuration comes from the process environment
  }
  const args = parseCaptureArgs(process.argv.slice(2));
  getConfig(); // fail early and cleanly with a ConfigError naming the missing variables
  await STEPS[args.step](args.caseName, args.image);
}

main().catch((error: unknown) => {
  if (error instanceof CaptureArgsError) {
    console.error(`${error.message}\n${USAGE}`);
  } else if (error instanceof AppError) {
    console.error(`${error.name}: ${error.detail ?? error.message}`);
  } else {
    console.error(stripSecrets(error instanceof Error ? `${error.name}: ${error.message}` : String(error)));
  }
  process.exit(1);
});
