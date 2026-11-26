import { describe, expect, it } from "vitest";
import { createBudget } from "./budget";

describe("createBudget", () => {
  it("allows spending while the estimate fits", () => {
    const b = createBudget(1);
    expect(b.canSpend(0.4)).toBe(true);
    b.record(0.4);
    expect(b.spent).toBeCloseTo(0.4);
    expect(b.canSpend(0.6)).toBe(true);
    expect(b.stopped).toBe(false);
    expect(b.stopReason).toBeNull();
  });

  it("stops before a call that would exceed the budget and stays stopped", () => {
    const b = createBudget(1);
    b.record(0.8);
    expect(b.canSpend(0.3)).toBe(false);
    expect(b.stopped).toBe(true);
    expect(b.stopReason).toMatch(/EVAL_MAX_COST_USD/);
    expect(b.stopReason).toMatch(/1/);
    expect(b.canSpend(0)).toBe(false);
  });

  it("counts a null cost as zero and increments unknownCostCalls", () => {
    const b = createBudget(1);
    b.record(null);
    b.record(0.1);
    b.record(null);
    expect(b.spent).toBeCloseTo(0.1);
    expect(b.unknownCostCalls).toBe(2);
  });

  it("stops when a recorded actual cost overshoots", () => {
    const b = createBudget(0.5);
    b.record(0.7);
    expect(b.stopped).toBe(true);
    expect(b.stopReason).toBeTruthy();
  });

  it("rejects an invalid budget", () => {
    expect(() => createBudget(-1)).toThrow();
    expect(() => createBudget(Number.NaN)).toThrow();
  });
});
