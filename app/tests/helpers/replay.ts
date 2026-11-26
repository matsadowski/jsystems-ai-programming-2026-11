// Replays recorded model calls as `MockLanguageModelV4` (ADR 002 §6.2). Capture files hold the
// recorded `doGenerate` result (object) or the ordered `doStream` parts (array), see
// `scripts/capture.ts`. JSON turns Dates into strings, so timestamps are revived here.
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4, mockValues } from "ai/test";
import type { LanguageModelV4GenerateResult, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { loadCapture } from "./captures";

export type RecordedGenerate = LanguageModelV4GenerateResult;
export type RecordedStream = LanguageModelV4StreamPart[];

const reviveDate = (v: unknown): unknown => (typeof v === "string" ? new Date(v) : v);

function reviveGenerate(r: RecordedGenerate): RecordedGenerate {
  if (r.response && "timestamp" in r.response) {
    return { ...r, response: { ...r.response, timestamp: reviveDate(r.response.timestamp) as Date } };
  }
  return r;
}

function reviveParts(parts: RecordedStream): RecordedStream {
  return parts.map((p) =>
    p.type === "response-metadata" && "timestamp" in p
      ? { ...p, timestamp: reviveDate(p.timestamp) as Date }
      : p,
  );
}

const generateOf = (src: string | RecordedGenerate): RecordedGenerate =>
  typeof src === "string" ? loadCapture<RecordedGenerate>("llm", src) : src;
/** A flat parts array is one call; an array of arrays is one stream per call. */
function callsOf(src: string | RecordedStream | RecordedStream[]): RecordedStream[] {
  const data = typeof src === "string" ? loadCapture<RecordedStream | RecordedStream[]>("llm", src) : src;
  return Array.isArray(data[0]) ? (data as RecordedStream[]) : [data as RecordedStream];
}

/** One `doGenerate` result, returned on every call. */
export function replayGenerate(source: string | RecordedGenerate): MockLanguageModelV4 {
  const result = reviveGenerate(generateOf(source));
  return new MockLanguageModelV4({ doGenerate: async () => result });
}

/** Recorded stream(s): call n replays stream n, the last one repeats (tool call, then continuation). */
export function replayStream(source: string | RecordedStream | RecordedStream[]): MockLanguageModelV4 {
  const calls = callsOf(source).map(reviveParts);
  let index = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      const parts = calls[Math.min(index++, calls.length - 1)];
      return { stream: simulateReadableStream({ chunks: parts }) };
    },
  });
}

/** One recorded `doGenerate` result per call (the last one repeats): corrective retries etc. */
export function replaySequence(sources: (string | RecordedGenerate)[]): MockLanguageModelV4 {
  const results = sources.map((s) => reviveGenerate(generateOf(s)));
  const next = mockValues(...results);
  return new MockLanguageModelV4({ doGenerate: async () => next() });
}
