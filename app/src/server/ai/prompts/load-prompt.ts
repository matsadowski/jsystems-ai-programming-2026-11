// Prompt loader (ADR 002 §3.2). Prompt files are Markdown next to this module; the first line is
// `version: <name>@<n>`. `cwd` is `app/` in dev, build and tests.
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

export const PROMPT_NAMES = [
  "vision-return",
  "vision-complaint",
  "decision-return",
  "decision-complaint",
  "chat-system",
] as const;
export type PromptName = (typeof PROMPT_NAMES)[number];

export interface LoadedPrompt {
  text: string;
  version: string;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;
const VERSION_LINE = /^version:\s*(\S+)[ \t]*\r?\n/;

function readPromptFile(name: PromptName): { body: string; version: string } {
  const file = path.join(process.cwd(), "src/server/ai/prompts", `${name}.md`);
  const raw = readFileSync(file, "utf8");
  const match = VERSION_LINE.exec(raw);
  if (!match) throw new Error(`Prompt ${name} has no version line`);
  return { body: raw.slice(match[0].length).replace(/^\s*\n/, ""), version: match[1] };
}

/** Names of the `{{placeholders}}` a prompt needs, in order of first appearance. */
export function placeholdersOf(name: PromptName): string[] {
  const { body } = readPromptFile(name);
  return [...new Set([...body.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

/** Loads a prompt, strips the version line and fills placeholders in a single pass. */
export function loadPrompt(name: PromptName, vars: Record<string, string>): LoadedPrompt {
  const { body, version } = readPromptFile(name);
  // Single pass: placeholders inside inserted values are not expanded again (injection safety).
  const text = body.replace(PLACEHOLDER, (_m, key: string) => {
    const value = vars[key];
    if (value === undefined) throw new Error(`Prompt ${name}: missing value for {{${key}}}`);
    return value;
  });
  return { text, version };
}

/** The `<preliminary_assessment>` block for the escalated decision prompt, or "" (ADR 004 §4.5). */
export function preliminaryAssessmentBlock(body: string | undefined): string {
  const trimmed = body?.trim();
  if (!trimmed) return "";
  return `<preliminary_assessment>\n${trimmed}\n</preliminary_assessment>`;
}
