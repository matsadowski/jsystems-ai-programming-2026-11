import { afterEach, describe, expect, it } from "vitest";
import { captureLogs, type CapturedLogs } from "../../../tests/helpers/log-capture";
import { logger } from "./logger";

let logs: CapturedLogs;
afterEach(() => logs.restore());

describe("logger", () => {
  it("writes one JSON line per call", () => {
    logs = captureLogs();
    logger.warn("evt", { a: 1 });
    expect(logs.lines).toHaveLength(1);
    expect(JSON.parse(logs.lines[0])).toMatchObject({ level: "warn", event: "evt", a: 1 });
  });

  it("redacts OpenRouter keys in values and nested fields", () => {
    logs = captureLogs();
    logger.info("x", { msg: "bad sk-or-v1-abc123def", nested: { deep: ["Bearer sk-or-v1-zzz999"] } });
    expect(logs.text()).not.toContain("abc123def");
    expect(logs.text()).not.toContain("zzz999");
    expect(logs.text()).toContain("[REDACTED]");
  });

  it("redacts sensitive keys", () => {
    logs = captureLogs();
    logger.error("x", { apiKey: "plain", Authorization: "Basic q", token: "t0k", note: "ok" });
    expect(logs.text()).not.toMatch(/plain|Basic q|t0k/);
    expect(logs.text()).toContain("ok");
  });

  it("replaces long base64 and data URLs", () => {
    logs = captureLogs();
    const b64 = "QUJD".repeat(512);
    logger.info("x", { img: b64, url: "data:image/png;base64," + "A".repeat(600), short: "QUJD" });
    expect(logs.text()).not.toContain(b64);
    expect(logs.text()).toContain("[REDACTED_BASE64 len=2048]");
    expect(logs.text()).toContain("[REDACTED_BASE64 len=622]");
    expect(logs.text()).toContain("QUJD");
  });

  it("does not throw on circular fields", () => {
    logs = captureLogs();
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(() => logger.info("x", o)).not.toThrow();
  });
});
