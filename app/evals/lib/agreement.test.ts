import { describe, expect, it } from "vitest";
import { agreementByCell } from "./agreement";

describe("agreementByCell", () => {
  it("computes the modal share per cell and the 2/3 target", () => {
    const r = agreementByCell([
      { cellId: "a", decision: "ACCEPT" },
      { cellId: "a", decision: "ACCEPT" },
      { cellId: "a", decision: "REJECT" },
      { cellId: "b", decision: "ACCEPT" },
      { cellId: "b", decision: "REJECT" },
      { cellId: "b", decision: "NEEDS_MANUAL_REVIEW" },
      { cellId: "c", decision: "REPAIR" },
      { cellId: "c", decision: "REPAIR" },
      { cellId: "c", decision: "REPAIR" },
    ]);
    expect(r).toEqual([
      { cellId: "a", runs: 3, modalDecision: "ACCEPT", agreeing: 2, rate: 2 / 3, meetsTarget: true },
      { cellId: "b", runs: 3, modalDecision: "ACCEPT", agreeing: 1, rate: 1 / 3, meetsTarget: false },
      { cellId: "c", runs: 3, modalDecision: "REPAIR", agreeing: 3, rate: 1, meetsTarget: true },
    ]);
  });

  it("keeps first-seen cell order and handles an empty input", () => {
    expect(agreementByCell([])).toEqual([]);
    expect(agreementByCell([{ cellId: "z", decision: "REJECT" }, { cellId: "a", decision: "REJECT" }]).map((c) => c.cellId)).toEqual(["z", "a"]);
  });
});
