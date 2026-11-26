// Loads real captured responses (ADR 000 TAC-06, AGENTS.md mock rule). Every capture file
// `<name>.json` has a sibling `<name>.meta.json`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const CAPTURE_DIRS = {
  llm: path.resolve(__dirname, "../fixtures/llm-captures"),
  api: path.resolve(__dirname, "../fixtures/api-captures"),
} as const;

export type CaptureKind = keyof typeof CAPTURE_DIRS;

/** Required keys in every `.meta.json`. */
export const REQUIRED_META_KEYS = ["capturedAt", "target", "request"] as const;

export function listCaptures(kind: CaptureKind): string[] {
  const dir = CAPTURE_DIRS[kind];
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".meta.json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function loadCapture<T = unknown>(kind: CaptureKind, name: string): T {
  return JSON.parse(readFileSync(path.join(CAPTURE_DIRS[kind], `${name}.json`), "utf8")) as T;
}

export function loadCaptureMeta(kind: CaptureKind, name: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(CAPTURE_DIRS[kind], `${name}.meta.json`), "utf8"),
  ) as Record<string, unknown>;
}
