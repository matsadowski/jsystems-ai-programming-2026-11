import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError, TypeValidationError } from "ai";
import { describe, expect, it } from "vitest";
import {
  AiInvalidOutputError,
  AiTimeoutError,
  AiUnavailableError,
  AppError,
  CaseNotFoundError,
} from "@/server/http/errors";
import { toAppAiError } from "./errors";

const noObject = () =>
  new NoObjectGeneratedError({
    message: "bad",
    text: "{",
    response: { id: "r", timestamp: new Date(0), modelId: "m" },
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as never,
    finishReason: "stop",
  });

describe("toAppAiError", () => {
  it("passes an existing AppError through unchanged", () => {
    const err = new CaseNotFoundError();
    expect(toAppAiError(err, "chat")).toBe(err);
    expect(toAppAiError(new AiTimeoutError(), "vision")).toBeInstanceOf(AiTimeoutError);
  });

  it("maps AbortError DOMException to AiTimeoutError", () => {
    const e = toAppAiError(new DOMException("aborted", "AbortError"), "vision");
    expect(e).toBeInstanceOf(AiTimeoutError);
    expect(e.code).toBe("AI_TIMEOUT");
  });

  it("maps TimeoutError DOMException (AbortSignal.timeout) to AiTimeoutError", () => {
    expect(toAppAiError(new DOMException("t", "TimeoutError"), "decision")).toBeInstanceOf(AiTimeoutError);
  });

  it("maps a real AbortSignal.timeout reason", async () => {
    const signal = AbortSignal.timeout(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(toAppAiError(signal.reason, "chat")).toBeInstanceOf(AiTimeoutError);
  });

  it("finds a timeout in the cause chain and in RetryError", () => {
    const wrapped = new APICallError({
      message: "x",
      url: "u",
      requestBodyValues: {},
      cause: new DOMException("t", "TimeoutError"),
    });
    expect(toAppAiError(wrapped, "vision")).toBeInstanceOf(AiTimeoutError);
    const retry = new RetryError({
      message: "r",
      reason: "maxRetriesExceeded",
      errors: [new DOMException("t", "TimeoutError")],
    });
    expect(toAppAiError(retry, "vision")).toBeInstanceOf(AiTimeoutError);
  });

  it("maps NoObjectGeneratedError to AiInvalidOutputError", () => {
    expect(toAppAiError(noObject(), "decision")).toBeInstanceOf(AiInvalidOutputError);
  });

  it("maps NoOutputGeneratedError to AiInvalidOutputError", () => {
    expect(toAppAiError(new NoOutputGeneratedError(), "decision")).toBeInstanceOf(AiInvalidOutputError);
  });

  it("maps TypeValidationError to AiInvalidOutputError", () => {
    expect(
      toAppAiError(new TypeValidationError({ value: 1, cause: new Error("zod") }), "vision"),
    ).toBeInstanceOf(AiInvalidOutputError);
  });

  it("maps APICallError to AiUnavailableError", () => {
    const err = new APICallError({ message: "502", url: "u", requestBodyValues: {}, statusCode: 502 });
    expect(toAppAiError(err, "vision")).toBeInstanceOf(AiUnavailableError);
  });

  it("maps unknown errors and non-errors to AiUnavailableError", () => {
    expect(toAppAiError(new Error("boom"), "chat")).toBeInstanceOf(AiUnavailableError);
    expect(toAppAiError("weird", "chat")).toBeInstanceOf(AiUnavailableError);
    expect(toAppAiError(undefined, "chat")).toBeInstanceOf(AiUnavailableError);
  });

  it("keeps the cause and a diagnostic detail with the kind", () => {
    const cause = new Error("boom");
    const e = toAppAiError(cause, "decision");
    expect(e).toBeInstanceOf(AppError);
    expect(e.cause).toBe(cause);
    expect(e.detail).toContain("decision");
    expect(e.detail).toContain("boom");
  });
});
