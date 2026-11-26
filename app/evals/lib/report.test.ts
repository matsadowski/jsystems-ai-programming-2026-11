import { describe, expect, it } from "vitest";
import { evaluateThresholds } from "./luna-thresholds";
import { LIMITATION_SENTENCE, renderReport, type ReportInput } from "./report";

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  runDate: "2026-11-26",
  models: { vision: "vision/model-x", decision: "decision/model-y" },
  promptVersions: { vision: "vision@3", decision: "decision@2" },
  policyVersion: "policy@1",
  budget: { maxUsd: 5, spent: 1.2345, stopped: false, stopReason: null, unknownCostCalls: 0 },
  cases: [
    { caseId: "matrix-laptop-1-return", runs: 3, decisions: ["ACCEPT", "ACCEPT", "REJECT"], p50LatencyMs: 12000, costUsd: 0.05, passed: null },
    { caseId: "return-15-days", runs: 1, decisions: ["REJECT"], p50LatencyMs: 20, costUsd: 0, passed: true },
    { caseId: "category-mismatch", runs: 1, decisions: ["ACCEPT"], p50LatencyMs: 9000, costUsd: null, passed: false },
  ],
  invariantFailures: [],
  fallbackRate: 0.1,
  agreement: [{ cellId: "matrix-laptop-1-return", runs: 3, modalDecision: "ACCEPT", agreeing: 2, rate: 2 / 3, meetsTarget: true }],
  ...over,
});

describe("renderReport", () => {
  it("renders header facts, budget, tables and the limitation sentence", () => {
    const md = renderReport(input());
    expect(md).toMatch(/^# /);
    expect(md).toContain("2026-11-26");
    expect(md).toContain("vision/model-x");
    expect(md).toContain("decision/model-y");
    expect(md).toContain("vision@3");
    expect(md).toContain("policy@1");
    expect(md).toContain("$1.2345");
    expect(md).toContain("$5");
    expect(md).toContain("matrix-laptop-1-return");
    expect(md).toContain("| return-15-days |");
    expect(md).toContain("PASS");
    expect(md).toContain("FAIL");
    expect(md).toContain("10%");
    expect(md).toContain("67%");
    expect(md).toContain(LIMITATION_SENTENCE);
    expect(LIMITATION_SENTENCE).toBe("10 images × 3 runs is a smoke test, not a statistical validation.");
  });

  it("states no budget stop when not stopped, and the stop reason when stopped", () => {
    expect(renderReport(input())).toMatch(/no budget stop/i);
    const md = renderReport(input({ budget: { maxUsd: 5, spent: 4.9, stopped: true, stopReason: "Next call would exceed EVAL_MAX_COST_USD=5", unknownCostCalls: 2 } }));
    expect(md).toContain("Next call would exceed EVAL_MAX_COST_USD=5");
    expect(md).toMatch(/unknown cost/i);
    expect(md).not.toMatch(/no budget stop/i);
  });

  it("lists invariant failures or says there are none", () => {
    expect(renderReport(input())).toMatch(/no invariant failures/i);
    const md = renderReport(input({ invariantFailures: [{ caseId: "x-case", run: 2, failures: [{ code: "LATENCY", message: "latency 99999 ms > budget 5000 ms" }] }] }));
    expect(md).toContain("x-case");
    expect(md).toContain("LATENCY");
    expect(md).toContain("latency 99999 ms");
    expect(md).not.toMatch(/no invariant failures/i);
  });

  it("escapes pipes in table cells", () => {
    const md = renderReport(input({ cases: [{ caseId: "a|b", runs: 1, decisions: ["REJECT"], p50LatencyMs: 1, costUsd: 0, passed: null }] }));
    expect(md).toContain("a\\|b");
  });

  it("omits the Luna section without Luna data", () => {
    expect(renderReport(input())).not.toMatch(/threshold/i);
  });

  it("renders the threshold table and the recommendation when Luna data is present", () => {
    const luna = evaluateThresholds([]);
    const md = renderReport(input({ luna: { model: "luna-x", report: luna } }));
    expect(md).toContain("luna-x");
    for (const t of ["0.60", "0.70", "0.80", "0.90", "0.95"]) expect(md).toContain(t);
    expect(md).toMatch(/stay in shadow/i);
    expect(md).toMatch(/unsafe/i);
  });

  it("renders a SWITCH recommendation with the threshold", () => {
    const luna = evaluateThresholds([]);
    const md = renderReport(input({ luna: { model: "m", report: { ...luna, recommendation: { kind: "SWITCH", threshold: 0.7 } } } }));
    expect(md).toMatch(/0\.70/);
    expect(md).toMatch(/gated/);
  });
});
