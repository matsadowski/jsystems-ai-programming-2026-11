// Pure parts of the capture script (ADR 002 §6.1): fixture cases, argument parsing, meta building
// and secret stripping. No I/O, no network.
import type { CaseType, DeviceCategory } from "../src/lib/shared/enums";

export const CAPTURE_STEPS = ["vision", "decision", "chat", "luna"] as const;
export type CaptureStep = (typeof CAPTURE_STEPS)[number];

export interface FixtureCase {
  step: CaptureStep;
  caseType: CaseType;
  category: DeviceCategory;
  model: string;
  /** Purchase date = capture day minus this many calendar days. */
  daysAgo: number;
  /** Employee reason; empty for returns. Never describes the photo (assets/example-images/README.md). */
  reason: string;
  /** File name in `assets/example-images/`. */
  image: string;
  /** Captures this one builds on (decision uses the vision analysis, chat uses both). */
  visionCase?: string;
  decisionCase?: string;
  /** Chat step: the employee's message. */
  userMessage?: string;
}

const COMPLAINT_REASON = "Klient zgłasza usterkę urządzenia i prosi o rozpatrzenie reklamacji.";

const RETURN_PHONE = {
  caseType: "RETURN",
  category: "SMARTPHONE",
  model: "Smartfon testowy",
  daysAgo: 5,
  reason: "",
  image: "phone-1.jpg",
} as const;
const COMPLAINT_LAPTOP = {
  caseType: "COMPLAINT",
  category: "LAPTOP",
  model: "Laptop testowy",
  daysAgo: 60,
  reason: COMPLAINT_REASON,
  image: "laptop-2.webp",
} as const;

export const FIXTURE_CASES: Record<string, FixtureCase> = {
  "vision-return-phone-1": { step: "vision", ...RETURN_PHONE },
  "vision-complaint-laptop-2": { step: "vision", ...COMPLAINT_LAPTOP },
  "decision-return-phone-1": { step: "decision", ...RETURN_PHONE, visionCase: "vision-return-phone-1" },
  "decision-complaint-laptop-2": {
    step: "decision",
    ...COMPLAINT_LAPTOP,
    visionCase: "vision-complaint-laptop-2",
  },
  "chat-plain": {
    step: "chat",
    ...RETURN_PHONE,
    visionCase: "vision-return-phone-1",
    decisionCase: "decision-return-phone-1",
    userMessage: "Jaka jest data zakupu?",
  },
  "chat-revise": {
    step: "chat",
    ...COMPLAINT_LAPTOP,
    visionCase: "vision-complaint-laptop-2",
    decisionCase: "decision-complaint-laptop-2",
    userMessage: "Klient przyznał, że telefon wpadł do wody.",
  },
  "luna-return-phone-1": { step: "luna", ...RETURN_PHONE },
  "luna-complaint-laptop-2": { step: "luna", ...COMPLAINT_LAPTOP },
};

export function stepOfCase(caseName: string): CaptureStep {
  const c = FIXTURE_CASES[caseName];
  if (!c) throw new CaptureArgsError(`unknown case "${caseName}"`);
  return c.step;
}

export class CaptureArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureArgsError";
  }
}

export interface CaptureArgs {
  step: CaptureStep;
  caseName: string;
  /** Overrides the fixture's example image (file name only). */
  image?: string;
}

export const USAGE =
  "Usage: npm run capture -- --step vision|decision|chat|luna --case <fixture-case> [--image <file>]\n" +
  `Cases: ${Object.keys(FIXTURE_CASES).join(", ")}`;

function readFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new CaptureArgsError(`unexpected argument "${arg}"`);
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      flags.set(arg.slice(2, eq), arg.slice(eq + 1));
    } else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) throw new CaptureArgsError(`${arg} needs a value`);
      flags.set(arg.slice(2), next);
      i++;
    }
  }
  return flags;
}

export function parseCaptureArgs(argv: string[]): CaptureArgs {
  const flags = readFlags(argv);
  const step = flags.get("step");
  const caseName = flags.get("case");
  if (!step) throw new CaptureArgsError("--step is required");
  if (!(CAPTURE_STEPS as readonly string[]).includes(step)) {
    throw new CaptureArgsError(`unknown step "${step}" (expected ${CAPTURE_STEPS.join("|")})`);
  }
  if (!caseName) throw new CaptureArgsError("--case is required");
  const fixture = FIXTURE_CASES[caseName];
  if (!fixture) throw new CaptureArgsError(`unknown case "${caseName}"`);
  if (fixture.step !== step) {
    throw new CaptureArgsError(`case "${caseName}" belongs to step "${fixture.step}", not "${step}"`);
  }
  const image = flags.get("image");
  if (image !== undefined && !/^[\w][\w.-]*$/.test(image)) {
    throw new CaptureArgsError(`--image must be a file name inside assets/example-images, got "${image}"`);
  }
  return { step: step as CaptureStep, caseName, image };
}

/** `todayIso` minus `days` calendar days (pure ISO dates, DST-safe). */
export function isoDaysBefore(todayIso: string, days: number): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

const SECRET = /sk-or-[\w-]+/g;

/** Deep copy with every `sk-or-…` key replaced. */
export function stripSecrets<T>(value: T): T {
  if (typeof value === "string") return value.replace(SECRET, "[REDACTED]") as T;
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripSecrets(v)])) as T;
  }
  return value;
}

const SECRET_HEADERS = new Set(["authorization", "cookie", "set-cookie", "proxy-authorization"]);

function dropSecretHeaders(headers: unknown): unknown {
  if (headers === null || typeof headers !== "object" || Array.isArray(headers)) return headers;
  return Object.fromEntries(Object.entries(headers).filter(([k]) => !SECRET_HEADERS.has(k.toLowerCase())));
}

/**
 * Prepares a recorded `doGenerate` result (object) or stream parts (array) for disk: removes
 * `request.body` (it holds the base64 image), auth headers and any `sk-or-` key.
 */
export function sanitizeRecorded(recorded: unknown): unknown {
  if (recorded === null || typeof recorded !== "object" || Array.isArray(recorded)) {
    return stripSecrets(recorded);
  }
  const copy: Record<string, unknown> = { ...(recorded as Record<string, unknown>) };
  if (copy.request && typeof copy.request === "object") {
    const { body: _body, ...rest } = copy.request as Record<string, unknown>;
    void _body;
    copy.request = rest;
  }
  if (copy.response && typeof copy.response === "object") {
    const response = { ...(copy.response as Record<string, unknown>) };
    if ("headers" in response) response.headers = dropSecretHeaders(response.headers);
    copy.response = response;
  }
  return stripSecrets(copy);
}

export interface BuildMetaInput {
  capturedAt: Date;
  /** Model slug or endpoint URL. */
  target: string;
  step: CaptureStep;
  caseName: string;
  caseType: CaseType;
  category: DeviceCategory;
  imageFile: string;
  promptVersion?: string;
  policyVersion?: string;
  questionsVersion?: string;
  packages: Record<string, string>;
}

export interface CaptureMeta {
  capturedAt: string;
  target: string;
  request: Record<string, string>;
  packages: Record<string, string>;
}

export function buildMeta(input: BuildMetaInput): CaptureMeta {
  const request: Record<string, string> = {
    step: input.step,
    case: input.caseName,
    caseType: input.caseType,
    category: input.category,
    imageFile: input.imageFile,
  };
  if (input.promptVersion) request.promptVersion = input.promptVersion;
  if (input.policyVersion) request.policyVersion = input.policyVersion;
  if (input.questionsVersion) request.questionsVersion = input.questionsVersion;
  return stripSecrets({
    capturedAt: input.capturedAt.toISOString(),
    target: input.target,
    request,
    packages: input.packages,
  });
}
