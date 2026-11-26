import { describe, expect, it } from "vitest";
import type { DecisionOutput, ReturnImageAnalysis, ComplaintImageAnalysis } from "@/server/ai/schemas";
import type { DecisionFacts } from "@/server/domain/case";
import {
  checkDecision,
  expiredWindowDecision,
  fallbackDecision,
  type GuardrailContext,
  type ViolationCode,
} from "./guardrails";

const CLAUSES = new Set(["R1.1", "R1.3", "R4.1", "R5", "C1.1", "C1.3", "C4.2", "C2.2"]);

const okFacts: DecisionFacts = {
  submissionDate: "2026-11-25",
  daysSincePurchase: 5,
  windowDays: 14,
  withinWindow: true,
  deadOnArrivalWindow: false,
};
const expiredReturnFacts: DecisionFacts = { ...okFacts, daysSincePurchase: 20, withinWindow: false };
const expiredComplaintFacts: DecisionFacts = {
  ...okFacts,
  daysSincePurchase: 800,
  windowDays: 730,
  withinWindow: false,
};
const complaintFacts: DecisionFacts = { ...okFacts, windowDays: 730, daysSincePurchase: 100 };

const returnAnalysis = (o: Partial<ReturnImageAnalysis> = {}): ReturnImageAnalysis => ({
  deviceVisible: true,
  detectedDevice: "laptop",
  matchesDeclaredCategory: "YES",
  photoQuality: "SUFFICIENT",
  qualityIssues: [],
  observations: [],
  summary: "Opis.",
  signsOfUse: "NONE_VISIBLE",
  resaleableAsNew: "YES",
  packagingOrAccessoriesVisible: [],
  ...o,
});
const complaintAnalysis = (o: Partial<ComplaintImageAnalysis> = {}): ComplaintImageAnalysis => ({
  deviceVisible: true,
  detectedDevice: "laptop",
  matchesDeclaredCategory: "YES",
  photoQuality: "SUFFICIENT",
  qualityIssues: [],
  observations: [],
  summary: "Opis.",
  describedDefectVisible: "YES",
  damage: [],
  likelyCauses: [],
  ...o,
});

const out = (o: Partial<DecisionOutput> & { decision: string }): DecisionOutput =>
  ({
    citedClauses: ["R1.1"],
    justification: ["Powód (R1.1)."],
    nextSteps: ["Krok."],
    missingEvidence: [],
    confidence: "HIGH",
    ...o,
  }) as DecisionOutput;

const retCtx = (o: Partial<GuardrailContext> = {}): GuardrailContext => ({
  caseType: "RETURN",
  facts: okFacts,
  analysis: returnAnalysis(),
  clauseIds: CLAUSES,
  ...o,
});
const cmpCtx = (o: Partial<GuardrailContext> = {}): GuardrailContext => ({
  caseType: "COMPLAINT",
  facts: complaintFacts,
  analysis: complaintAnalysis(),
  clauseIds: CLAUSES,
  ...o,
});
const codes = (output: DecisionOutput, ctx: GuardrailContext): ViolationCode[] =>
  checkDecision(output, ctx).map((v) => v.code);

describe("checkDecision", () => {
  it("passes a valid return ACCEPT and a valid complaint REPAIR", () => {
    expect(checkDecision(out({ decision: "ACCEPT" }), retCtx())).toEqual([]);
    expect(
      checkDecision(out({ decision: "REPAIR", citedClauses: ["C1.1"] }), cmpCtx()),
    ).toEqual([]);
  });

  it("G1: decision outside the case-type enum", () => {
    expect(codes(out({ decision: "REPAIR", citedClauses: ["R1.1"] }), retCtx())).toContain("NOT_ALLOWED");
    expect(codes(out({ decision: "ACCEPT", citedClauses: ["C1.1"] }), cmpCtx())).toContain("NOT_ALLOWED");
  });

  it("G1 has a plain-English message", () => {
    const [v] = checkDecision(out({ decision: "REPAIR" }), retCtx());
    expect(v.message).toMatch(/REPAIR/);
  });

  describe("G2 expired window", () => {
    it("ACCEPT on expired return", () => {
      expect(codes(out({ decision: "ACCEPT" }), retCtx({ facts: expiredReturnFacts }))).toEqual([
        "WINDOW_EXPIRED_NOT_REJECTED",
      ]);
    });
    it("REJECT without R1.3", () => {
      expect(codes(out({ decision: "REJECT" }), retCtx({ facts: expiredReturnFacts }))).toEqual([
        "WINDOW_EXPIRED_NOT_REJECTED",
      ]);
    });
    it("REJECT with R1.3 passes", () => {
      expect(
        codes(out({ decision: "REJECT", citedClauses: ["R1.3"] }), retCtx({ facts: expiredReturnFacts })),
      ).toEqual([]);
    });
    it("complaint: REJECT with C1.3 passes, with R1.3 only fails", () => {
      const ctx = cmpCtx({ facts: expiredComplaintFacts });
      expect(codes(out({ decision: "REJECT", citedClauses: ["C1.3"] }), ctx)).toEqual([]);
      expect(codes(out({ decision: "REJECT", citedClauses: ["C1.1"] }), ctx)).toEqual([
        "WINDOW_EXPIRED_NOT_REJECTED",
      ]);
    });
    it("takes precedence over G3/G3c/G6", () => {
      const bad = returnAnalysis({ photoQuality: "INSUFFICIENT", signsOfUse: "CLEAR" });
      expect(
        codes(out({ decision: "ACCEPT" }), retCtx({ facts: expiredReturnFacts, analysis: bad })),
      ).toEqual(["WINDOW_EXPIRED_NOT_REJECTED"]);
      const badC = complaintAnalysis({ describedDefectVisible: "NO" });
      expect(
        codes(
          out({ decision: "REPAIR", citedClauses: ["C1.1"] }),
          cmpCtx({ facts: expiredComplaintFacts, analysis: badC }),
        ),
      ).toEqual(["WINDOW_EXPIRED_NOT_REJECTED"]);
    });
  });

  describe("G3 insufficient evidence", () => {
    const cases: [string, Partial<ReturnImageAnalysis>][] = [
      ["device not visible", { deviceVisible: false }],
      ["insufficient quality", { photoQuality: "INSUFFICIENT" }],
      ["category NO", { matchesDeclaredCategory: "NO" }],
      ["category UNCERTAIN", { matchesDeclaredCategory: "UNCERTAIN" }],
    ];
    for (const [name, patch] of cases) {
      it(`${name} with ACCEPT is a violation`, () => {
        expect(codes(out({ decision: "ACCEPT" }), retCtx({ analysis: returnAnalysis(patch) }))).toEqual([
          "INSUFFICIENT_EVIDENCE_NOT_REVIEW",
        ]);
      });
      it(`${name} with NEEDS_MANUAL_REVIEW passes`, () => {
        expect(
          codes(
            out({ decision: "NEEDS_MANUAL_REVIEW", citedClauses: ["R4.1"], missingEvidence: ["x"] }),
            retCtx({ analysis: returnAnalysis(patch) }),
          ),
        ).toEqual([]);
      });
    }
    it("applies to complaints", () => {
      expect(
        codes(
          out({ decision: "REPAIR", citedClauses: ["C1.1"] }),
          cmpCtx({ analysis: complaintAnalysis({ photoQuality: "INSUFFICIENT" }) }),
        ),
      ).toEqual(["INSUFFICIENT_EVIDENCE_NOT_REVIEW"]);
    });
  });

  describe("G3c defect not visible", () => {
    for (const v of ["NO", "UNCERTAIN"] as const) {
      it(`${v} with REPAIR is a violation`, () => {
        expect(
          codes(
            out({ decision: "REPAIR", citedClauses: ["C1.1"] }),
            cmpCtx({ analysis: complaintAnalysis({ describedDefectVisible: v }) }),
          ),
        ).toEqual(["DEFECT_NOT_VISIBLE_NOT_REVIEW"]);
      });
    }
    it("NOT_PHOTOGRAPHABLE does not trigger", () => {
      expect(
        codes(
          out({ decision: "REPAIR", citedClauses: ["C1.1"] }),
          cmpCtx({ analysis: complaintAnalysis({ describedDefectVisible: "NOT_PHOTOGRAPHABLE" }) }),
        ),
      ).toEqual([]);
    });
    it("NEEDS_MANUAL_REVIEW with NO passes", () => {
      expect(
        codes(
          out({ decision: "NEEDS_MANUAL_REVIEW", citedClauses: ["C4.2"], missingEvidence: ["x"] }),
          cmpCtx({ analysis: complaintAnalysis({ describedDefectVisible: "NO" }) }),
        ),
      ).toEqual([]);
    });
    it("is not evaluated for return analysis", () => {
      expect(codes(out({ decision: "ACCEPT" }), retCtx())).toEqual([]);
    });
  });

  describe("G4 clauses", () => {
    it("unknown clause", () => {
      expect(codes(out({ decision: "ACCEPT", citedClauses: ["R9.9"] }), retCtx())).toEqual(["UNKNOWN_CLAUSE"]);
    });
    it("wrong prefix (C clause on a return)", () => {
      expect(codes(out({ decision: "ACCEPT", citedClauses: ["C1.1"] }), retCtx())).toEqual(["UNKNOWN_CLAUSE"]);
    });
    it("wrong prefix (R clause on a complaint)", () => {
      expect(codes(out({ decision: "REPAIR", citedClauses: ["R1.1"] }), cmpCtx())).toEqual(["UNKNOWN_CLAUSE"]);
    });
    it("section clause present in the set passes", () => {
      expect(codes(out({ decision: "ACCEPT", citedClauses: ["R5"] }), retCtx())).toEqual([]);
    });
  });

  describe("G5 missing evidence", () => {
    it("empty missingEvidence on NEEDS_MANUAL_REVIEW", () => {
      expect(
        codes(out({ decision: "NEEDS_MANUAL_REVIEW", citedClauses: ["R4.1"] }), retCtx()),
      ).toEqual(["MISSING_EVIDENCE_EMPTY"]);
    });
    it("non-empty passes", () => {
      expect(
        codes(
          out({ decision: "NEEDS_MANUAL_REVIEW", citedClauses: ["R4.1"], missingEvidence: ["x"] }),
          retCtx(),
        ),
      ).toEqual([]);
    });
  });

  describe("G6 accept with visible use", () => {
    it("signsOfUse CLEAR", () => {
      expect(
        codes(out({ decision: "ACCEPT" }), retCtx({ analysis: returnAnalysis({ signsOfUse: "CLEAR" }) })),
      ).toEqual(["ACCEPT_WITH_VISIBLE_USE"]);
    });
    it("resaleableAsNew NO", () => {
      expect(
        codes(out({ decision: "ACCEPT" }), retCtx({ analysis: returnAnalysis({ resaleableAsNew: "NO" }) })),
      ).toEqual(["ACCEPT_WITH_VISIBLE_USE"]);
    });
    it("CANNOT_DETERMINE is left to the model", () => {
      expect(
        codes(
          out({ decision: "ACCEPT" }),
          retCtx({ analysis: returnAnalysis({ signsOfUse: "CANNOT_DETERMINE" }) }),
        ),
      ).toEqual([]);
    });
    it("REJECT with CLEAR use is fine", () => {
      expect(
        codes(out({ decision: "REJECT" }), retCtx({ analysis: returnAnalysis({ signsOfUse: "CLEAR" }) })),
      ).toEqual([]);
    });
  });

  it("analysis null skips G3/G3c/G6 but still runs G1/G2/G4/G5", () => {
    expect(codes(out({ decision: "ACCEPT" }), retCtx({ analysis: null }))).toEqual([]);
    expect(codes(out({ decision: "REPAIR", citedClauses: ["C1.1"] }), cmpCtx({ analysis: null }))).toEqual([]);
    expect(
      codes(out({ decision: "NEEDS_MANUAL_REVIEW", citedClauses: ["R9.9"] }), retCtx({ analysis: null })),
    ).toEqual(["UNKNOWN_CLAUSE", "MISSING_EVIDENCE_EMPTY"]);
  });

  it("reports several violations in rule order", () => {
    const ctx = retCtx({ analysis: returnAnalysis({ photoQuality: "INSUFFICIENT", signsOfUse: "CLEAR" }) });
    expect(codes(out({ decision: "ACCEPT", citedClauses: ["R9.9"] }), ctx)).toEqual([
      "INSUFFICIENT_EVIDENCE_NOT_REVIEW",
      "UNKNOWN_CLAUSE",
      "ACCEPT_WITH_VISIBLE_USE",
    ]);
  });
});

describe("expiredWindowDecision", () => {
  it("return text", () => {
    const d = expiredWindowDecision("RETURN", expiredReturnFacts, "RULES");
    expect(d.decision).toBe("REJECT");
    expect(d.source).toBe("RULES");
    expect(d.citedClauses).toEqual(["R1.3"]);
    expect(d.justification).toEqual([
      "Od daty zakupu minęło 20 dni, a termin wynosi 14 dni (pkt R1.3).",
      "Jeśli klient zgłasza wadę, można rozważyć reklamację.",
    ]);
    expect(d.nextSteps.length).toBeGreaterThanOrEqual(1);
    expect(d.nextSteps.length).toBeLessThanOrEqual(2);
    expect(d.nextSteps[0]).toContain("R1.3");
    expect(d.missingEvidence).toEqual([]);
    expect(d.confidence).toBe("HIGH");
    expect(d.violationsOnFirstAttempt).toEqual([]);
  });
  it("complaint text", () => {
    const d = expiredWindowDecision("COMPLAINT", expiredComplaintFacts, "GUARDRAIL");
    expect(d.source).toBe("GUARDRAIL");
    expect(d.citedClauses).toEqual(["C1.3"]);
    expect(d.justification).toEqual([
      "Od daty zakupu minęło 800 dni, a termin wynosi 24 miesiące (pkt C1.3).",
      "Może obowiązywać gwarancja producenta.",
    ]);
    expect(d.nextSteps[0]).toContain("C1.3");
  });
  it("passes checkDecision", () => {
    for (const [ct, facts] of [
      ["RETURN", expiredReturnFacts],
      ["COMPLAINT", expiredComplaintFacts],
    ] as const) {
      const d = expiredWindowDecision(ct, facts, "RULES");
      expect(checkDecision(d as DecisionOutput, { caseType: ct, facts, analysis: null, clauseIds: CLAUSES })).toEqual([]);
    }
  });
});

describe("fallbackDecision", () => {
  const v = (code: ViolationCode) => [{ code, message: "m" }];

  it("expired return via violation", () => {
    const d = fallbackDecision(retCtx({ facts: expiredReturnFacts }), v("WINDOW_EXPIRED_NOT_REJECTED"));
    expect(d.decision).toBe("REJECT");
    expect(d.source).toBe("GUARDRAIL");
    expect(d.citedClauses).toEqual(["R1.3"]);
  });
  it("expired via facts even without a G2 violation", () => {
    const d = fallbackDecision(cmpCtx({ facts: expiredComplaintFacts }), v("UNKNOWN_CLAUSE"));
    expect(d.decision).toBe("REJECT");
    expect(d.citedClauses).toEqual(["C1.3"]);
    expect(d.source).toBe("GUARDRAIL");
  });
  it("G2 violation forces expired decision even if facts say within window", () => {
    const d = fallbackDecision(retCtx(), v("WINDOW_EXPIRED_NOT_REJECTED"));
    expect(d.decision).toBe("REJECT");
  });
  it("return manual review with quality issues", () => {
    const analysis = returnAnalysis({
      photoQuality: "INSUFFICIENT",
      qualityIssues: ["BLURRY", "TOO_DARK", "OVEREXPOSED", "PARTIAL_VIEW", "OBSTRUCTED"],
    });
    const ctx = retCtx({ analysis });
    const d = fallbackDecision(ctx, v("INSUFFICIENT_EVIDENCE_NOT_REVIEW"));
    expect(d.decision).toBe("NEEDS_MANUAL_REVIEW");
    expect(d.citedClauses).toEqual(["R4.1"]);
    expect(d.source).toBe("GUARDRAIL");
    expect(d.violationsOnFirstAttempt).toEqual(["INSUFFICIENT_EVIDENCE_NOT_REVIEW"]);
    expect(d.missingEvidence).toEqual([
      "Wyraźniejsze, ostre zdjęcie",
      "Zdjęcie przy lepszym oświetleniu",
      "Zdjęcie bez prześwietlenia",
      "Zdjęcie całego urządzenia",
      "Zdjęcie bez zasłoniętych elementów",
    ]);
    expect(checkDecision(d as DecisionOutput, ctx)).toEqual([]);
  });
  it("LOW_RESOLUTION translated", () => {
    const d = fallbackDecision(
      retCtx({ analysis: returnAnalysis({ qualityIssues: ["LOW_RESOLUTION"] }) }),
      v("UNKNOWN_CLAUSE"),
    );
    expect(d.missingEvidence).toEqual(["Zdjęcie w wyższej rozdzielczości"]);
  });
  it("complaint manual review without quality issues", () => {
    const ctx = cmpCtx();
    const d = fallbackDecision(ctx, v("DEFECT_NOT_VISIBLE_NOT_REVIEW"));
    expect(d.decision).toBe("NEEDS_MANUAL_REVIEW");
    expect(d.citedClauses).toEqual(["C4.2"]);
    expect(d.missingEvidence).toEqual(["Automatyczna ocena była niespójna — wymagana ocena pracownika"]);
    expect(checkDecision(d as DecisionOutput, ctx)).toEqual([]);
  });
  it("null analysis falls back to the generic missing evidence", () => {
    const ctx = retCtx({ analysis: null });
    const d = fallbackDecision(ctx, v("UNKNOWN_CLAUSE"));
    expect(d.missingEvidence).toEqual(["Automatyczna ocena była niespójna — wymagana ocena pracownika"]);
    expect(checkDecision(d as DecisionOutput, ctx)).toEqual([]);
  });
  it("caps missing evidence at 5 entries", () => {
    const analysis = returnAnalysis({
      qualityIssues: ["BLURRY", "TOO_DARK", "OVEREXPOSED", "PARTIAL_VIEW", "OBSTRUCTED", "LOW_RESOLUTION"],
    });
    expect(fallbackDecision(retCtx({ analysis }), v("UNKNOWN_CLAUSE")).missingEvidence).toHaveLength(5);
  });
});
