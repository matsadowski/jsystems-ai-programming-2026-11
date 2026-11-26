import { describe, expect, it } from "vitest";
import type { DecisionFacts } from "@/server/domain/case";
import { isFastPathEligible } from "./eligibility";

const facts = (withinWindow: boolean): DecisionFacts => ({
  submissionDate: "2026-11-25",
  daysSincePurchase: withinWindow ? 3 : 20,
  windowDays: 14,
  withinWindow,
  deadOnArrivalWindow: withinWindow,
});

describe("isFastPathEligible", () => {
  it("expired window is RULES, before any other check", () => {
    expect(isFastPathEligible("RETURN", "OTHER", facts(false))).toEqual({ eligible: false, reason: "RULES" });
  });
  it("OTHER is not eligible", () => {
    expect(isFastPathEligible("COMPLAINT", "OTHER", facts(true))).toEqual({ eligible: false, reason: "CATEGORY_OTHER" });
  });
  it("return AUDIO is not eligible", () => {
    expect(isFastPathEligible("RETURN", "AUDIO", facts(true))).toEqual({ eligible: false, reason: "RETURN_AUDIO" });
  });
  it("complaint AUDIO and other categories are eligible", () => {
    expect(isFastPathEligible("COMPLAINT", "AUDIO", facts(true))).toEqual({ eligible: true });
    expect(isFastPathEligible("RETURN", "LAPTOP", facts(true))).toEqual({ eligible: true });
  });
});
