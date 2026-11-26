import { describe, expect, it } from "vitest";
import { checkInvariants, fallbackRate, isPolish } from "./invariants";

const good = {
  decision: "ACCEPT",
  citedClauses: ["R1.1", "R2.1"],
  justification: ["Zgłoszenie mieści się w terminie zwrotu."],
  nextSteps: ["Klient pakuje urządzenie wraz z akcesoriami."],
};
const base = { caseType: "RETURN" as const, decision: good, clauseIds: ["R1.1", "R2.1", "R2.2"], latencyMs: 1000, budgetMs: 5000 };

describe("checkInvariants", () => {
  it("passes a valid decision", () => {
    expect(checkInvariants(base)).toEqual([]);
  });

  it("flags cited clauses that do not exist", () => {
    const f = checkInvariants({ ...base, decision: { ...good, citedClauses: ["R1.1", "R9.9"] } });
    expect(f.map((x) => x.code)).toEqual(["UNKNOWN_CLAUSE"]);
    expect(f[0].message).toContain("R9.9");
  });

  it("flags a decision with no cited clauses", () => {
    expect(checkInvariants({ ...base, decision: { ...good, citedClauses: [] } }).map((x) => x.code)).toContain("NO_CLAUSES");
  });

  it("flags a decision value not allowed for the case type", () => {
    expect(checkInvariants({ ...base, decision: { ...good, decision: "REPAIR" } }).map((x) => x.code)).toContain("INVALID_DECISION_VALUE");
  });

  it("flags English text", () => {
    const f = checkInvariants({
      ...base,
      decision: { ...good, justification: ["The device is within the return window and the photo is clear."] },
    });
    expect(f.map((x) => x.code)).toContain("NOT_POLISH");
  });

  it("flags latency over budget, not at budget", () => {
    expect(checkInvariants({ ...base, latencyMs: 5001 }).map((x) => x.code)).toEqual(["LATENCY"]);
    expect(checkInvariants({ ...base, latencyMs: 5000 })).toEqual([]);
  });

  it("reports several failures at once", () => {
    const f = checkInvariants({ ...base, latencyMs: 9999, decision: { ...good, citedClauses: ["X1"] } });
    expect(f.map((x) => x.code).sort()).toEqual(["LATENCY", "UNKNOWN_CLAUSE"]);
  });
});

describe("isPolish", () => {
  it("accepts Polish with diacritics", () => {
    expect(isPolish(["Zdjęcie jest ostre."])).toBe(true);
  });
  it("accepts Polish with stop-words and no diacritics", () => {
    expect(isPolish(["Zgloszenie nie jest w terminie oraz brak dowodu."])).toBe(true);
  });
  it("rejects English", () => {
    expect(isPolish(["The request is valid and the device is in good condition."])).toBe(false);
  });
  it("rejects Polish text with an English sentence mixed in", () => {
    expect(isPolish(["Zgłoszenie jest w terminie. The customer is not eligible for this refund."])).toBe(false);
  });
  it("tolerates short technical fragments and clause ids", () => {
    expect(isPolish(["Zgłoszenie jest poprawne (pkt R1.1). OK."])).toBe(true);
  });
  it("rejects empty text", () => {
    expect(isPolish([""])).toBe(false);
  });
});

describe("fallbackRate", () => {
  it("is the share of GUARDRAIL decisions", () => {
    expect(fallbackRate([{ decisionSource: "MODEL" }, { decisionSource: "GUARDRAIL" }, { decisionSource: "MODEL" }, { decisionSource: "MODEL" }])).toBe(0.25);
  });
  it("is 0 for no results", () => {
    expect(fallbackRate([])).toBe(0);
  });
});
