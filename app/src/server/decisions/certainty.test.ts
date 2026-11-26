import { describe, expect, it } from "vitest";
import type { LunaAnswer } from "@/server/domain/case";
import { assess, certaintyOf, toLunaAnswer } from "./certainty";

describe("certaintyOf", () => {
  it("noul without confidence uses max(p, 1-p)", () => {
    expect(certaintyOf({ type: "noul", noul: 0.85 })).toBeCloseTo(0.85);
    expect(certaintyOf({ type: "noul", noul: 0.15 })).toBeCloseTo(0.85);
  });
  it("noul with confidence uses confidence", () => {
    expect(certaintyOf({ type: "noul", noul: 0.99, confidence: 0.6 })).toBe(0.6);
  });
  it("noul with a non-numeric noul is null", () => {
    expect(certaintyOf({ type: "noul", noul: "yes" })).toBeNull();
  });
  it("choice: confidence or highest probability", () => {
    expect(certaintyOf({ type: "choice", choice: "a", probabilities: { a: 0.7, b: 0.3 } })).toBe(0.7);
    expect(
      certaintyOf({ type: "choice", choice: "a", probabilities: { a: 0.9, b: 0.1 }, confidence: 0.79 }),
    ).toBe(0.79);
  });
  it("choice with missing/invalid choice or probabilities is null", () => {
    expect(certaintyOf({ type: "choice", probabilities: { a: 1 } })).toBeNull();
    expect(certaintyOf({ type: "choice", choice: "a" })).toBeNull();
    expect(certaintyOf({ type: "choice", choice: "a", probabilities: null })).toBeNull();
    expect(certaintyOf({ type: "choice", choice: "a", probabilities: {} })).toBeNull();
    expect(certaintyOf({ type: "choice", choice: "a", probabilities: { a: "x" } })).toBeNull();
  });
  it("score: record or array probabilities", () => {
    expect(certaintyOf({ type: "score", score: 1.2, probabilities: { "0": 0.1, "1": 0.75, "2": 0.15 } })).toBe(0.75);
    expect(certaintyOf({ type: "score", score: 1, probabilities: [0.1, 0.2, 0.7] })).toBe(0.7);
    expect(certaintyOf({ type: "score", score: 1, probabilities: [0.5, 0.5], confidence: 0.9 })).toBe(0.9);
  });
  it("score without probabilities or score is null", () => {
    expect(certaintyOf({ type: "score", score: 1 })).toBeNull();
    expect(certaintyOf({ type: "score", probabilities: [1] })).toBeNull();
  });
  it("refusal, missing, unknown type and junk are null", () => {
    expect(certaintyOf({ type: "refusal" })).toBeNull();
    expect(certaintyOf(undefined)).toBeNull();
    expect(certaintyOf(null)).toBeNull();
    expect(certaintyOf("noul")).toBeNull();
    expect(certaintyOf({ type: "box", box: {} })).toBeNull();
    expect(certaintyOf({})).toBeNull();
  });
});

describe("toLunaAnswer", () => {
  it("noul value is noul >= 0.5", () => {
    expect(toLunaAnswer("k", { type: "noul", noul: 0.5, confidence: 0.9 })).toEqual({
      key: "k",
      type: "noul",
      value: true,
      certainty: 0.9,
    });
    expect(toLunaAnswer("k", { type: "noul", noul: 0.49 }).value).toBe(false);
  });
  it("choice keeps option and probabilities", () => {
    expect(toLunaAnswer("k", { type: "choice", choice: "a", probabilities: { a: 0.9, b: 0.1 } })).toEqual({
      key: "k",
      type: "choice",
      value: "a",
      certainty: 0.9,
      probabilities: { a: 0.9, b: 0.1 },
    });
  });
  it("score value is the argmax bucket, not the rounded score", () => {
    const a = toLunaAnswer("k", { type: "score", score: 1.9, probabilities: { "0": 0.1, "1": 0.8, "2": 0.1 } });
    expect(a.value).toBe(1);
    expect(a.probabilities).toEqual({ "0": 0.1, "1": 0.8, "2": 0.1 });
    expect(toLunaAnswer("k", { type: "score", score: 0, probabilities: [0.2, 0.3, 0.5] }).value).toBe(2);
  });
  it("refusal, missing and malformed map to non-answers", () => {
    expect(toLunaAnswer("k", { type: "refusal" })).toEqual({ key: "k", type: "refusal", value: null, certainty: null });
    expect(toLunaAnswer("k", undefined)).toEqual({ key: "k", type: "missing", value: null, certainty: null });
    expect(toLunaAnswer("k", { type: "weird" }).type).toBe("missing");
    expect(toLunaAnswer("k", { type: "noul" }).type).toBe("missing");
  });
});

describe("assess", () => {
  const ans = (key: string, certainty: number | null, type: LunaAnswer["type"] = "noul"): LunaAnswer => ({
    key,
    type,
    value: type === "noul" ? true : null,
    certainty,
  });
  it("boundary: 0.80 is certain, 0.7999 is not", () => {
    expect(assess([ans("a", 0.8)], 0.8).allCertain).toBe(true);
    expect(assess([ans("a", 0.7999)], 0.8)).toEqual({ allCertain: false, uncertainKeys: ["a"], refusedKeys: [] });
  });
  it("null certainty is uncertain; refusal and missing are refused and uncertain", () => {
    const r = assess([ans("a", null), ans("b", null, "refusal"), ans("c", null, "missing"), ans("d", 0.95)], 0.8);
    expect(r).toEqual({ allCertain: false, uncertainKeys: ["a", "b", "c"], refusedKeys: ["b", "c"] });
  });
  it("empty list is not allCertain", () => {
    expect(assess([], 0.8).allCertain).toBe(false);
  });
});
