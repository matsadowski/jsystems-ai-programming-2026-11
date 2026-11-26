import { describe, expect, it } from "vitest";
import {
  ComplaintDecisionOutputSchema,
  ComplaintImageAnalysisSchema,
  ReturnDecisionOutputSchema,
  ReturnImageAnalysisSchema,
  ReviseDecisionInputSchema,
} from "./schemas";

const common = {
  deviceVisible: true,
  detectedDevice: "smartfon, widok z przodu",
  matchesDeclaredCategory: "YES",
  photoQuality: "SUFFICIENT",
  qualityIssues: [],
  observations: [{ area: "ekran", finding: "brak rys", severity: "NONE" }],
  summary: "Zdjęcie przedstawia smartfon. Ekran jest cały.",
};

describe("LLM output schemas (ADR 002 §4)", () => {
  it("return analysis requires return-only fields", () => {
    expect(
      ReturnImageAnalysisSchema.safeParse({
        ...common,
        signsOfUse: "NONE_VISIBLE",
        resaleableAsNew: "YES",
        packagingOrAccessoriesVisible: [],
      }).success,
    ).toBe(true);
    expect(ReturnImageAnalysisSchema.safeParse(common).success).toBe(false);
  });

  it("complaint analysis requires complaint-only fields and caps arrays", () => {
    const ok = { ...common, describedDefectVisible: "UNCERTAIN", damage: [], likelyCauses: [] };
    expect(ComplaintImageAnalysisSchema.safeParse(ok).success).toBe(true);
    const tooMany = Array.from({ length: 9 }, () => ({
      type: "rysa",
      location: "ekran",
      severity: "MINOR",
    }));
    expect(ComplaintImageAnalysisSchema.safeParse({ ...ok, damage: tooMany }).success).toBe(false);
  });

  it("return decision allows only return values and R-clauses", () => {
    const d = {
      decision: "ACCEPT",
      citedClauses: ["R1.1", "R2"],
      justification: ["Zgodnie z R1.1 zwrot w terminie."],
      nextSteps: ["Przyjmij zwrot."],
      missingEvidence: [],
      confidence: "HIGH",
    };
    expect(ReturnDecisionOutputSchema.safeParse(d).success).toBe(true);
    expect(ReturnDecisionOutputSchema.safeParse({ ...d, decision: "REPAIR" }).success).toBe(false);
    expect(ReturnDecisionOutputSchema.safeParse({ ...d, citedClauses: ["C1.1"] }).success).toBe(
      false,
    );
    expect(ReturnDecisionOutputSchema.safeParse({ ...d, citedClauses: [] }).success).toBe(false);
    expect(
      ReturnDecisionOutputSchema.safeParse({ ...d, justification: ["x".repeat(301)] }).success,
    ).toBe(false);
  });

  it("complaint decision allows complaint values and C-clauses", () => {
    const d = {
      decision: "REPAIR",
      citedClauses: ["C3.1"],
      justification: ["C3.1"],
      nextSteps: ["Przekaż do serwisu."],
      missingEvidence: [],
      confidence: "MEDIUM",
    };
    expect(ComplaintDecisionOutputSchema.safeParse(d).success).toBe(true);
    expect(ComplaintDecisionOutputSchema.safeParse({ ...d, decision: "ACCEPT" }).success).toBe(
      false,
    );
  });

  it("reviseDecision input: reason 10–500 chars, clauses 1–6", () => {
    const ok = { newDecision: "REJECT", reason: "Klient potwierdził zalanie.", citedClauses: ["C2.2"] };
    expect(ReviseDecisionInputSchema.safeParse(ok).success).toBe(true);
    expect(ReviseDecisionInputSchema.safeParse({ ...ok, reason: "krótko" }).success).toBe(false);
  });
});
