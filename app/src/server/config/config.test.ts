import { afterEach, describe, expect, it } from "vitest";
import { captureLogs, type CapturedLogs } from "../../../tests/helpers/log-capture";
import { ConfigError } from "@/server/http/errors";
import { toErrorResponse } from "@/server/http/responses";
import { getConfig, resetConfigCache } from "./config";

const SECRET = "sk-or-v1-supersecretvalue123";
const valid = { OPENROUTER_API_KEY: SECRET, VISION_MODEL: "v/model", DECISION_MODEL: "d/model" };

let logs: CapturedLogs | undefined;
afterEach(() => {
  logs?.restore();
  logs = undefined;
  resetConfigCache();
});

function catchError(env: Record<string, string | undefined>): ConfigError {
  try {
    getConfig(env);
  } catch (e) {
    return e as ConfigError;
  }
  throw new Error("expected getConfig to throw");
}

describe("getConfig", () => {
  it("applies defaults", () => {
    const c = getConfig({ ...valid });
    expect(c).toMatchObject({
      openrouterApiKey: SECRET,
      visionModel: "v/model",
      decisionModel: "d/model",
      decisionReasoningEffort: "medium",
      chatReasoningEffort: "low",
      caseTtlMinutes: 120,
      caseStoreMax: 200,
      appTimezone: "Europe/Warsaw",
      decisionMode: "shadow",
      lunaModel: "openai/gpt-6-luna-decisions",
      lunaConfidenceThreshold: 0.8,
      lunaTimeoutMs: 5000,
      evalMaxCostUsd: 5,
    });
    expect(c.policyDir.startsWith("/")).toBe(true);
    expect(c.policyDir.endsWith("docs/policies")).toBe(true);
  });

  it("parses overrides and treats empty strings as missing", () => {
    const c = getConfig({ ...valid, CASE_TTL_MINUTES: "5", DECISION_MODE: "gated", APP_TIMEZONE: "" });
    expect(c.caseTtlMinutes).toBe(5);
    expect(c.decisionMode).toBe("gated");
    expect(c.appTimezone).toBe("Europe/Warsaw");
  });

  it.each(["OPENROUTER_API_KEY", "VISION_MODEL", "DECISION_MODEL"])("throws ConfigError when %s is missing", (name) => {
    logs = captureLogs();
    const env: Record<string, string | undefined> = { ...valid, [name]: undefined };
    const err = catchError(env);
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.detail).toContain(name);
    expect(logs.text()).toContain(name);
    expect(logs.text()).not.toContain(SECRET);
    expect(err.detail).not.toContain(SECRET);
    const res = toErrorResponse(err, "rid");
    expect(res.status).toBe(503);
  });

  it("treats an empty key as missing and names every missing variable", () => {
    const err = catchError({ OPENROUTER_API_KEY: "" });
    for (const n of ["OPENROUTER_API_KEY", "VISION_MODEL", "DECISION_MODEL"]) expect(err.detail).toContain(n);
  });

  it("503 body matches the spec", async () => {
    const res = toErrorResponse(catchError({}), "rid");
    expect(await res.json()).toEqual({
      error: { code: "CONFIG_ERROR", message: "Usługa jest chwilowo niedostępna (błąd konfiguracji)." },
    });
  });

  it("rejects out-of-range threshold without leaking the value", () => {
    const err = catchError({ ...valid, LUNA_CONFIDENCE_THRESHOLD: "0.3" });
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.detail).toContain("LUNA_CONFIDENCE_THRESHOLD");
    expect(err.detail).not.toContain("0.3");
  });

  it("rejects invalid DECISION_MODE and reasoning effort", () => {
    expect(catchError({ ...valid, DECISION_MODE: "foo" }).detail).toContain("DECISION_MODE");
    expect(catchError({ ...valid, CHAT_REASONING_EFFORT: "bad" }).detail).toContain("CHAT_REASONING_EFFORT");
  });

  it("caches process.env result but bypasses cache for explicit env", () => {
    const prev = { ...process.env };
    Object.assign(process.env, valid);
    try {
      const a = getConfig();
      expect(getConfig()).toBe(a);
      process.env.VISION_MODEL = "other";
      expect(getConfig()).toBe(a);
      resetConfigCache();
      expect(getConfig().visionModel).toBe("other");
    } finally {
      for (const k of Object.keys(valid)) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });
});
