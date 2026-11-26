import { describe, expect, it } from "vitest";
import { computeDecisionFacts } from "./facts";

describe("computeDecisionFacts (ADR 001 §4.2)", () => {
  it("return: day 14 is in time, day 15 is not (R1.2)", () => {
    expect(computeDecisionFacts("RETURN", "2026-11-11", "2026-11-25")).toEqual({
      submissionDate: "2026-11-25",
      daysSincePurchase: 14,
      windowDays: 14,
      withinWindow: true,
      deadOnArrivalWindow: false,
    });
    expect(computeDecisionFacts("RETURN", "2026-11-10", "2026-11-25").withinWindow).toBe(false);
  });

  it("complaint: 24 calendar months inclusive", () => {
    expect(computeDecisionFacts("COMPLAINT", "2024-11-25", "2026-11-25").withinWindow).toBe(true);
    expect(computeDecisionFacts("COMPLAINT", "2024-11-25", "2026-11-26").withinWindow).toBe(false);
    expect(computeDecisionFacts("COMPLAINT", "2024-11-25", "2026-11-25").windowDays).toBe(730);
  });

  it("complaint bought on 2024-02-29 expires after 2026-02-28", () => {
    expect(computeDecisionFacts("COMPLAINT", "2024-02-29", "2026-02-28").withinWindow).toBe(true);
    expect(computeDecisionFacts("COMPLAINT", "2024-02-29", "2026-03-01").withinWindow).toBe(false);
  });

  it("complaint dead-on-arrival window is ≤ 14 days (C3.2)", () => {
    expect(computeDecisionFacts("COMPLAINT", "2026-11-11", "2026-11-25").deadOnArrivalWindow).toBe(
      true,
    );
    expect(computeDecisionFacts("COMPLAINT", "2026-11-10", "2026-11-25").deadOnArrivalWindow).toBe(
      false,
    );
  });
});
