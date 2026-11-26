import { describe, expect, it } from "vitest";
import type { Case, Decision, DecisionValue } from "@/server/domain/case";
import { applyRevision } from "./revise-decision";

const CLAUSES = new Set(["R1.3", "R2.1", "C1.3", "C2.1", "C2.4"]);
const NOW = "2026-11-26T10:00:00.000Z";

function decision(value: DecisionValue, extra: Partial<Decision> = {}): Decision {
  return {
    decision: value,
    citedClauses: ["R2.1"],
    justification: ["stare uzasadnienie"],
    nextSteps: ["Stary krok 1", "Stary krok 2"],
    missingEvidence: [],
    confidence: "HIGH",
    source: "MODEL",
    violationsOnFirstAttempt: [],
    ...extra,
  };
}

function makeCase(caseType: "RETURN" | "COMPLAINT", value: DecisionValue, withinWindow = true): Case {
  const d = decision(value);
  return {
    id: "c1",
    status: "DECIDED",
    input: { caseType, category: "LAPTOP", model: "ThinkBook 14", purchaseDate: "2026-11-01", reason: "Zepsuty ekran" },
    imageMeta: {} as never,
    analysis: null,
    facts: { submissionDate: "2026-11-26", daysSincePurchase: 25, windowDays: 14, withinWindow, deadOnArrivalWindow: false },
    decision: d,
    decisionHistory: [{ decision: d, at: "2026-11-26T09:00:00.000Z", trigger: "INITIAL" }],
    messages: [],
    policyVersion: "p1",
    promptVersions: { vision: "v", decision: "d", chat: "c" },
    decisionPath: "LLM",
    lunaAssessment: null,
    shadow: null,
    chatInProgress: true,
    chatStartedAt: NOW,
    createdAt: NOW,
    lastAccessAt: NOW,
  };
}

const ctx = { clauseIds: CLAUSES, nowIso: NOW, messageId: "m-7" };
const input = (newDecision: string, citedClauses = ["R2.1"]) => ({
  newDecision,
  reason: "Pracownik potwierdził nowy fakt",
  citedClauses,
});

describe("applyRevision errors", () => {
  it("NOT_ALLOWED_FOR_CASE_TYPE for a value outside the case-type enum", () => {
    const c = makeCase("RETURN", "ACCEPT");
    const r = applyRevision(c, input("REPAIR"), ctx);
    expect(r).toEqual({ result: { ok: false, error: "NOT_ALLOWED_FOR_CASE_TYPE" }, updated: null });
    const c2 = makeCase("COMPLAINT", "REPAIR");
    expect(applyRevision(c2, input("ACCEPT", ["C2.1"]), ctx).result).toEqual({
      ok: false,
      error: "NOT_ALLOWED_FOR_CASE_TYPE",
    });
    expect(applyRevision(c2, input("BOGUS", ["C2.1"]), ctx).updated).toBeNull();
  });

  it("SAME_DECISION when the value equals the current decision", () => {
    const c = makeCase("RETURN", "ACCEPT");
    expect(applyRevision(c, input("ACCEPT"), ctx)).toEqual({
      result: { ok: false, error: "SAME_DECISION" },
      updated: null,
    });
  });

  it("WINDOW_EXPIRED when the window expired and the new value is not REJECT", () => {
    const c = makeCase("RETURN", "NEEDS_MANUAL_REVIEW", false);
    expect(applyRevision(c, input("ACCEPT"), ctx)).toEqual({
      result: { ok: false, error: "WINDOW_EXPIRED" },
      updated: null,
    });
  });

  it("REJECT is allowed after the window expired", () => {
    const c = makeCase("RETURN", "NEEDS_MANUAL_REVIEW", false);
    expect(applyRevision(c, input("REJECT", ["R1.3"]), ctx).result.ok).toBe(true);
  });

  it("UNKNOWN_CLAUSE for an unknown clause id", () => {
    const c = makeCase("RETURN", "ACCEPT");
    expect(applyRevision(c, input("REJECT", ["R9.9"]), ctx).result).toEqual({ ok: false, error: "UNKNOWN_CLAUSE" });
  });

  it("UNKNOWN_CLAUSE for a clause with the wrong prefix", () => {
    const c = makeCase("RETURN", "ACCEPT");
    expect(applyRevision(c, input("REJECT", ["C1.3"]), ctx).result).toEqual({ ok: false, error: "UNKNOWN_CLAUSE" });
  });

  it("UNKNOWN_CLAUSE when only one of several clauses is unknown", () => {
    const c = makeCase("RETURN", "ACCEPT");
    expect(applyRevision(c, input("REJECT", ["R1.3", "R7.7"]), ctx).updated).toBeNull();
  });

  it("checks in order: case type, same decision, window, clause", () => {
    const c = makeCase("RETURN", "ACCEPT", false);
    expect(applyRevision(c, input("ACCEPT", ["R9.9"]), ctx).result).toEqual({ ok: false, error: "SAME_DECISION" });
    expect(applyRevision(c, input("NEEDS_MANUAL_REVIEW", ["R9.9"]), ctx).result).toEqual({
      ok: false,
      error: "WINDOW_EXPIRED",
    });
  });
});

describe("applyRevision success", () => {
  it("revising to NEEDS_MANUAL_REVIEW always yields non-empty missingEvidence (guardrail G5)", () => {
    const c = makeCase("RETURN", "ACCEPT");
    const { updated } = applyRevision(c, input("NEEDS_MANUAL_REVIEW", ["R2.1"]), ctx);
    expect(updated).not.toBeNull();
    expect(updated?.decision?.missingEvidence.length).toBeGreaterThan(0);
  });

  it("returns labelled result and a CHAT_REVISION decision", () => {
    const c = makeCase("RETURN", "ACCEPT");
    const { result, updated } = applyRevision(c, input("REJECT", ["R1.3"]), ctx);
    expect(result).toEqual({
      ok: true,
      from: "ACCEPT",
      to: "REJECT",
      fromLabel: "Zwrot zaakceptowany",
      toLabel: "Zwrot odrzucony",
    });
    expect(updated?.decision).toMatchObject({
      decision: "REJECT",
      source: "CHAT_REVISION",
      justification: ["Pracownik potwierdził nowy fakt"],
      citedClauses: ["R1.3"],
      violationsOnFirstAttempt: [],
    });
  });

  it("appends a history entry with trigger, time and messageId", () => {
    const c = makeCase("RETURN", "ACCEPT");
    const { updated } = applyRevision(c, input("REJECT", ["R1.3"]), ctx);
    expect(updated?.decisionHistory).toHaveLength(2);
    expect(updated?.decisionHistory[1]).toEqual({
      decision: updated?.decision,
      at: NOW,
      trigger: "CHAT_REVISION",
      messageId: "m-7",
    });
  });

  it("omits messageId when not given", () => {
    const c = makeCase("RETURN", "ACCEPT");
    const { updated } = applyRevision(c, input("REJECT", ["R1.3"]), { clauseIds: CLAUSES, nowIso: NOW });
    expect(updated?.decisionHistory[1]).not.toHaveProperty("messageId");
  });

  it("replaces next steps with one Polish step on a REJECT/ACCEPT flip", () => {
    const c = makeCase("RETURN", "ACCEPT");
    const flipped = applyRevision(c, input("REJECT", ["R1.3"]), ctx).updated;
    expect(flipped?.decision?.nextSteps).toEqual(["Poinformuj klienta o zmianie decyzji (pkt R1.3)."]);
    const back = makeCase("RETURN", "REJECT");
    const accepted = applyRevision(back, input("ACCEPT", ["R2.1"]), ctx).updated;
    expect(accepted?.decision?.nextSteps).toEqual(["Poinformuj klienta o zmianie decyzji (pkt R2.1)."]);
  });

  it("keeps next steps when the change is not a flip", () => {
    const c = makeCase("COMPLAINT", "REPAIR");
    const { updated } = applyRevision(c, input("REPLACE", ["C2.1"]), ctx);
    expect(updated?.decision?.nextSteps).toEqual(["Stary krok 1", "Stary krok 2"]);
    expect(updated?.decision?.confidence).toBe("HIGH");
  });

  it("uses complaint labels for complaint cases", () => {
    const c = makeCase("COMPLAINT", "REPAIR");
    const { result } = applyRevision(c, input("REFUND", ["C2.4"]), ctx);
    expect(result).toMatchObject({ ok: true, fromLabel: "Reklamacja uznana — naprawa", toLabel: "Reklamacja uznana — zwrot środków" });
  });

  it("never mutates the input case", () => {
    const c = makeCase("RETURN", "ACCEPT");
    const snapshot = structuredClone(c);
    const { updated } = applyRevision(c, input("REJECT", ["R1.3"]), ctx);
    expect(c).toEqual(snapshot);
    expect(updated).not.toBe(c);
    expect(updated?.decisionHistory).not.toBe(c.decisionHistory);
  });
});

describe("applyRevision evidence guard (amendment D13: G3/G6 analogues)", () => {
  const baseAnalysis = {
    deviceVisible: true,
    detectedDevice: "laptop",
    matchesDeclaredCategory: "YES",
    photoQuality: "SUFFICIENT",
    qualityIssues: [],
    observations: [],
    summary: "Laptop.",
  };
  const returnCase = (analysis: Record<string, unknown>) => ({
    ...makeCase("RETURN", "NEEDS_MANUAL_REVIEW"),
    analysis: { ...baseAnalysis, signsOfUse: "NONE_VISIBLE", resaleableAsNew: "YES", packagingOrAccessoriesVisible: [], ...analysis } as never,
  });
  const complaintCase = (analysis: Record<string, unknown>) => ({
    ...makeCase("COMPLAINT", "NEEDS_MANUAL_REVIEW"),
    analysis: { ...baseAnalysis, describedDefectVisible: "YES", damage: [], likelyCauses: [], ...analysis } as never,
  });
  const accept = (basis?: "EMPLOYEE_STATEMENT" | "PHYSICAL_INSPECTION") => ({
    ...input("ACCEPT", ["R2.1"]),
    ...(basis ? { basis } : {}),
  });

  it("refuses ACCEPT on clear signs of use (G6) from an employee statement", () => {
    const { result, updated } = applyRevision(returnCase({ signsOfUse: "CLEAR" }), accept(), ctx);
    expect(result).toEqual({ ok: false, error: "EVIDENCE_CONTRADICTS" });
    expect(updated).toBeNull();
  });

  it("refuses ACCEPT when the photo is not resaleable as new (G6)", () => {
    expect(applyRevision(returnCase({ resaleableAsNew: "NO" }), accept(), ctx).result).toEqual({
      ok: false,
      error: "EVIDENCE_CONTRADICTS",
    });
  });

  it("refuses a positive decision on insufficient evidence (G3)", () => {
    for (const a of [{ photoQuality: "INSUFFICIENT" }, { deviceVisible: false }, { matchesDeclaredCategory: "UNCERTAIN" }]) {
      expect(applyRevision(returnCase(a), accept(), ctx).result).toEqual({ ok: false, error: "EVIDENCE_CONTRADICTS" });
    }
  });

  it("refuses REPAIR when the claimed defect is not visible (G3c)", () => {
    const c = complaintCase({ describedDefectVisible: "NO" });
    expect(applyRevision(c, input("REPAIR", ["C2.1"]), ctx).result).toEqual({ ok: false, error: "EVIDENCE_CONTRADICTS" });
  });

  it("allows the positive decision when the basis is a physical inspection", () => {
    const { result } = applyRevision(returnCase({ signsOfUse: "CLEAR" }), accept("PHYSICAL_INSPECTION"), ctx);
    expect(result.ok).toBe(true);
  });

  it("never blocks REJECT or NEEDS_MANUAL_REVIEW, and does not apply without an analysis", () => {
    const c = returnCase({ signsOfUse: "CLEAR", photoQuality: "INSUFFICIENT" });
    expect(applyRevision(c, input("REJECT", ["R2.1"]), ctx).result.ok).toBe(true);
    expect(applyRevision(makeCase("RETURN", "NEEDS_MANUAL_REVIEW"), accept(), ctx).result.ok).toBe(true);
  });
});
