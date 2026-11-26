// Certainty of raw Luna answers (ADR 004 §4.2). Pure; fails closed on anything unexpected.
import type { LunaAnswer } from "@/server/domain/case";

type Parsed = Pick<LunaAnswer, "value" | "certainty" | "probabilities"> & { type: "noul" | "choice" | "score" };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Probabilities as a record or an array; `null` when empty or not all numbers. */
function probsOf(raw: unknown): { entries: [string, number][]; probabilities: Record<string, number> | number[] } | null {
  if (!isObject(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length === 0 || !entries.every(([, p]) => isNum(p))) return null;
  return { entries: entries as [string, number][], probabilities: raw as Record<string, number> | number[] };
}

function parse(raw: unknown): Parsed | "refusal" | null {
  if (!isObject(raw)) return null;
  if (raw.type === "refusal") return "refusal";
  const confidence = isNum(raw.confidence) ? raw.confidence : undefined;
  if (raw.type === "noul") {
    if (!isNum(raw.noul)) return null;
    return { type: "noul", value: raw.noul >= 0.5, certainty: confidence ?? Math.max(raw.noul, 1 - raw.noul) };
  }
  if (raw.type === "choice" || raw.type === "score") {
    const probs = probsOf(raw.probabilities);
    if (!probs) return null;
    const best = probs.entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const certainty = confidence ?? best[1];
    if (raw.type === "choice") {
      if (typeof raw.choice !== "string") return null;
      return { type: "choice", value: raw.choice, certainty, probabilities: probs.probabilities };
    }
    if (!isNum(raw.score)) return null;
    return { type: "score", value: Number(best[0]), certainty, probabilities: probs.probabilities };
  }
  return null;
}

export function certaintyOf(raw: unknown): number | null {
  const p = parse(raw);
  return p === null || p === "refusal" ? null : p.certainty;
}

export function toLunaAnswer(key: string, raw: unknown): LunaAnswer {
  const p = parse(raw);
  if (p === "refusal") return { key, type: "refusal", value: null, certainty: null };
  if (p === null) return { key, type: "missing", value: null, certainty: null };
  return { key, ...p };
}

export interface Assessment {
  allCertain: boolean;
  uncertainKeys: string[];
  refusedKeys: string[];
}

export function assess(answers: LunaAnswer[], threshold: number): Assessment {
  const uncertainKeys: string[] = [];
  const refusedKeys: string[] = [];
  for (const a of answers) {
    if (a.type === "refusal" || a.type === "missing") refusedKeys.push(a.key);
    if (a.certainty === null || a.certainty < threshold) uncertainKeys.push(a.key);
  }
  return { allCertain: answers.length > 0 && uncertainKeys.length === 0, uncertainKeys, refusedKeys };
}
