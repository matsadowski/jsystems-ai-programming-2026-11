// Maps AI SDK / provider errors to the app error catalogue (ADR 002 §3.1, ADR 001 §5.4).
import {
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  RetryError,
  TypeValidationError,
} from "ai";
import {
  AiInvalidOutputError,
  AiTimeoutError,
  AiUnavailableError,
  AppError,
} from "@/server/http/errors";

export type AiCallKind = "vision" | "decision" | "chat";

const MAX_CAUSE_DEPTH = 5;

function isAbortOrTimeout(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError" || name === "TimeoutError";
}

/** Abort/timeout anywhere in the cause chain (and in `RetryError.lastError`). */
function hasTimeout(err: unknown, depth = 0): boolean {
  if (depth > MAX_CAUSE_DEPTH || err === null || err === undefined) return false;
  if (isAbortOrTimeout(err)) return true;
  if (RetryError.isInstance(err)) return hasTimeout(err.lastError, depth + 1);
  return hasTimeout((err as { cause?: unknown }).cause, depth + 1);
}

function isInvalidOutput(err: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(err) ||
    NoOutputGeneratedError.isInstance(err) ||
    TypeValidationError.isInstance(err)
  );
}

/** Log detail. Invalid-output errors carry model text in `message`: keep class name only (TAC-001-05). */
function describe(kind: AiCallKind, err: unknown): string {
  if (isInvalidOutput(err)) return `${kind}: ${(err as Error).name} (invalid or missing model output)`;
  if (err instanceof Error) return `${kind}: ${err.name}: ${err.message}`;
  return `${kind}: ${String(err)}`;
}

export function toAppAiError(err: unknown, kind: AiCallKind): AppError {
  if (err instanceof AppError) return err;
  const opts = { detail: describe(kind, err), cause: err };
  if (hasTimeout(err)) return new AiTimeoutError(opts);
  if (isInvalidOutput(err)) return new AiInvalidOutputError(opts);
  // APICallError and everything else.
  return new AiUnavailableError(opts);
}
