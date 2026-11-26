import { describe, expect, it } from "vitest";
import {
  FIXTURE_CASES,
  buildMeta,
  isoDaysBefore,
  parseCaptureArgs,
  stepOfCase,
  stripSecrets,
  sanitizeRecorded,
  CaptureArgsError,
} from "./capture-lib";

describe("parseCaptureArgs", () => {
  it("parses --step and --case", () => {
    expect(parseCaptureArgs(["--step", "vision", "--case", "vision-return-phone-1"])).toEqual({
      step: "vision",
      caseName: "vision-return-phone-1",
      image: undefined,
    });
  });
  it("parses --image and --key=value form", () => {
    const a = parseCaptureArgs(["--step=luna", "--case=luna-return-phone-1", "--image", "phone-2.jpeg"]);
    expect(a).toMatchObject({ step: "luna", image: "phone-2.jpeg" });
  });
  it("rejects an unknown step", () => {
    expect(() => parseCaptureArgs(["--step", "foo", "--case", "x"])).toThrow(CaptureArgsError);
  });
  it("rejects an unknown case", () => {
    expect(() => parseCaptureArgs(["--step", "vision", "--case", "nope"])).toThrow(/unknown case/i);
  });
  it("rejects a case that does not belong to the step", () => {
    expect(() => parseCaptureArgs(["--step", "chat", "--case", "vision-return-phone-1"])).toThrow(/step/);
  });
  it("requires --step and --case", () => {
    expect(() => parseCaptureArgs([])).toThrow(CaptureArgsError);
    expect(() => parseCaptureArgs(["--step", "vision"])).toThrow(/--case/);
  });
  it("rejects an image name with a path", () => {
    expect(() =>
      parseCaptureArgs(["--step", "vision", "--case", "vision-return-phone-1", "--image", "../x.jpg"]),
    ).toThrow(/image/);
  });
});

describe("FIXTURE_CASES", () => {
  it("defines the ten cases of the brief", () => {
    expect(Object.keys(FIXTURE_CASES).sort()).toEqual(
      [
        "chat-plain",
        "chat-revise",
        "decision-complaint-laptop-2",
        "decision-return-phone-1",
        "luna-complaint-laptop-2",
        "luna-return-phone-1",
        "vision-complaint-laptop-2",
        "vision-return-phone-1",
      ].sort(),
    );
  });
  it("uses only real example images and a reason that does not describe the photo", () => {
    expect(FIXTURE_CASES["vision-return-phone-1"]).toMatchObject({
      caseType: "RETURN",
      category: "SMARTPHONE",
      model: "Smartfon testowy",
      daysAgo: 5,
      image: "phone-1.jpg",
    });
    expect(FIXTURE_CASES["vision-complaint-laptop-2"]).toMatchObject({
      caseType: "COMPLAINT",
      category: "LAPTOP",
      model: "Laptop testowy",
      daysAgo: 60,
      image: "laptop-2.webp",
      reason: "Klient zgłasza usterkę urządzenia i prosi o rozpatrzenie reklamacji.",
    });
  });
  it("maps case names to steps", () => {
    expect(stepOfCase("luna-return-phone-1")).toBe("luna");
    expect(stepOfCase("decision-complaint-laptop-2")).toBe("decision");
    expect(stepOfCase("chat-revise")).toBe("chat");
  });
});

describe("isoDaysBefore", () => {
  it("subtracts calendar days", () => {
    expect(isoDaysBefore("2026-11-26", 5)).toBe("2026-11-21");
    expect(isoDaysBefore("2026-03-02", 5)).toBe("2026-02-25");
  });
});

describe("stripSecrets", () => {
  it("replaces sk-or- keys anywhere in nested data", () => {
    const out = stripSecrets({ a: "x sk-or-v1-abcdef0123 y", b: [{ c: "sk-or-zzzz-1234" }], n: 3 });
    expect(JSON.stringify(out)).not.toMatch(/sk-or-/);
    expect(out).toMatchObject({ n: 3 });
  });
  it("leaves clean data untouched", () => {
    expect(stripSecrets({ a: "hello", b: [1, null] })).toEqual({ a: "hello", b: [1, null] });
  });
});

describe("sanitizeRecorded", () => {
  it("drops request.body (base64 image) and strips secrets", () => {
    const out = sanitizeRecorded({
      content: [{ type: "text", text: "ok sk-or-v1-abcdef0123" }],
      request: { body: { huge: "data:image/jpeg;base64,AAAA" } },
      response: { id: "r1", headers: { authorization: "Bearer x" } },
    }) as Record<string, unknown>;
    expect(out.request).toEqual({});
    expect(JSON.stringify(out)).not.toMatch(/sk-or-/);
    expect(JSON.stringify(out)).not.toMatch(/base64/);
  });
  it("passes arrays (stream parts) through unchanged", () => {
    const parts = [{ type: "text-delta", id: "1", delta: "a" }];
    expect(sanitizeRecorded(parts)).toEqual(parts);
  });
});

describe("buildMeta", () => {
  it("builds meta with the required keys and no secrets", () => {
    const meta = buildMeta({
      capturedAt: new Date("2026-11-26T10:00:00Z"),
      target: "openai/gpt-x",
      step: "vision",
      caseName: "vision-return-phone-1",
      caseType: "RETURN",
      category: "SMARTPHONE",
      imageFile: "phone-1.jpg",
      promptVersion: "vision-return@1",
      packages: { ai: "7.0.183", "@openrouter/ai-sdk-provider": "3.1.0" },
    });
    expect(meta.capturedAt).toBe("2026-11-26T10:00:00.000Z");
    expect(meta.target).toBe("openai/gpt-x");
    expect(meta.request).toMatchObject({
      step: "vision",
      case: "vision-return-phone-1",
      caseType: "RETURN",
      category: "SMARTPHONE",
      imageFile: "phone-1.jpg",
      promptVersion: "vision-return@1",
    });
    expect(meta.packages).toEqual({ ai: "7.0.183", "@openrouter/ai-sdk-provider": "3.1.0" });
  });
  it("includes policyVersion and questionsVersion only when given", () => {
    const meta = buildMeta({
      capturedAt: new Date("2026-11-26T10:00:00Z"),
      target: "https://openrouter.ai/api/alpha/decisions",
      step: "luna",
      caseName: "luna-return-phone-1",
      caseType: "RETURN",
      category: "SMARTPHONE",
      imageFile: "phone-1.jpg",
      questionsVersion: "luna-questions@1",
      policyVersion: "abc",
      packages: {},
    });
    expect(meta.request).toMatchObject({ questionsVersion: "luna-questions@1", policyVersion: "abc" });
    expect(meta.request).not.toHaveProperty("promptVersion");
  });
});
