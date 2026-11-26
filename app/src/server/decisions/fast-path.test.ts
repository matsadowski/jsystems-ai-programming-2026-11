import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDecision } from "@/server/ai/guardrails";
import type { CaseType } from "@/lib/shared";
import type { Decision, DecisionFacts, LunaAnswer } from "@/server/domain/case";
import { mapToDecision } from "./fast-path";

const POLICY_DIR = path.resolve(__dirname, "../../../../docs/policies");
const clauseIdsOf = (file: string) =>
  new Set(
    readFileSync(path.join(POLICY_DIR, file), "utf8")
      .split("\n")
      .filter((l) => /^(#+\s|\s*[-*]\s+\*\*)/.test(l) || /^\s*[-*]\s+\*\*[RC]/.test(l))
      .flatMap((l) => [...l.matchAll(/\b([RC]\d+(?:\.\d+)?)\b/g)].map((m) => m[1])),
  );
const CLAUSES = {
  RETURN: clauseIdsOf("return-policy.md"),
  COMPLAINT: clauseIdsOf("complaint-policy.md"),
} as const;

const facts = (doa = false, withinWindow = true): DecisionFacts => ({
  submissionDate: "2026-11-25",
  daysSincePurchase: 3,
  windowDays: 14,
  withinWindow,
  deadOnArrivalWindow: doa,
});

const noul = (key: string, v: boolean): LunaAnswer => ({ key, type: "noul", value: v, certainty: 0.95 });
const choice = (key: string, v: string): LunaAnswer => ({ key, type: "choice", value: v, certainty: 0.95 });
const score = (v: number): LunaAnswer => ({ key: "signs_of_use", type: "score", value: v, certainty: 0.95 });

const ret = (dm: boolean, pa: boolean, s: number) => [noul("device_matches", dm), noul("photo_assessable", pa), score(s)];
const cmp = (dm: boolean, pa: boolean, dv: string, dc: string) => [
  noul("device_matches", dm),
  noul("photo_assessable", pa),
  choice("defect_visibility", dv),
  choice("damage_cause", dc),
];

function expectValid(caseType: CaseType, d: Decision | "UNMAPPED", f: DecisionFacts): Decision {
  if (d === "UNMAPPED") throw new Error("unexpected UNMAPPED");
  expect(d.source).toBe("FAST");
  expect(d.confidence).toBe("HIGH");
  expect(d.violationsOnFirstAttempt).toEqual([]);
  expect(d.decision).not.toBe("REFUND");
  expect(d.justification.length).toBeGreaterThan(0);
  expect(d.nextSteps.length).toBeGreaterThan(0);
  expect(
    checkDecision(d as never, { caseType, facts: f, analysis: null, clauseIds: CLAUSES[caseType] }),
  ).toEqual([]);
  if (d.decision === "NEEDS_MANUAL_REVIEW") expect(d.missingEvidence.length).toBeGreaterThan(0);
  for (const c of d.citedClauses) expect(d.justification.join(" ") + d.nextSteps.join(" ")).toContain(c.split(".")[0]);
  return d;
}

describe("policy clause scan", () => {
  it("finds the headings and bullets", () => {
    for (const c of ["R1.1", "R2.1", "R2.2", "R2.3", "R4.1", "R6"]) expect(CLAUSES.RETURN.has(c)).toBe(true);
    for (const c of ["C2.1", "C2.2", "C2.3", "C3.1", "C3.2", "C4.2", "C4.3", "C6"]) expect(CLAUSES.COMPLAINT.has(c)).toBe(true);
  });
});

describe("mapToDecision RETURN", () => {
  const rows: [string, LunaAnswer[], string, string[]][] = [
    ["device mismatch", ret(false, true, 0), "NEEDS_MANUAL_REVIEW", ["R4.1"]],
    ["device mismatch, photo bad", ret(false, false, 3), "NEEDS_MANUAL_REVIEW", ["R4.1"]],
    ["photo not assessable", ret(true, false, 0), "NEEDS_MANUAL_REVIEW", ["R4.1"]],
    ["no use", ret(true, true, 0), "ACCEPT", ["R1.1", "R2.1", "R2.2"]],
    ["unboxing marks", ret(true, true, 1), "ACCEPT", ["R1.1", "R2.1", "R2.2"]],
    ["slight wear", ret(true, true, 2), "NEEDS_MANUAL_REVIEW", ["R2.3"]],
    ["clear wear", ret(true, true, 3), "REJECT", ["R2.1", "R2.3"]],
  ];
  it.each(rows)("%s", (_n, answers, decision, clauses) => {
    const d = expectValid("RETURN", mapToDecision("RETURN", facts(), answers), facts());
    expect(d.decision).toBe(decision);
    expect(d.citedClauses).toEqual(clauses);
  });
  it("ACCEPT next steps follow R6", () => {
    const d = mapToDecision("RETURN", facts(), ret(true, true, 0)) as Decision;
    expect(d.nextSteps.join(" ")).toContain("R6");
  });
  it("signs_of_use out of range is UNMAPPED", () => {
    expect(mapToDecision("RETURN", facts(), ret(true, true, 7))).toBe("UNMAPPED");
  });
});

describe("mapToDecision COMPLAINT", () => {
  const rows: [string, LunaAnswer[], boolean, string, string[]][] = [
    ["device false", cmp(false, true, "visible", "impact"), false, "NEEDS_MANUAL_REVIEW", ["C4.2"]],
    ["photo false", cmp(true, false, "visible", "impact"), false, "NEEDS_MANUAL_REVIEW", ["C4.2"]],
    ["not_visible", cmp(true, true, "not_visible", "manufacturing_defect"), false, "NEEDS_MANUAL_REVIEW", ["C4.2"]],
    ["visible impact", cmp(true, true, "visible", "impact"), false, "REJECT", ["C2.2"]],
    ["visible liquid", cmp(true, true, "visible", "liquid_or_heat"), false, "REJECT", ["C2.2"]],
    ["np modification", cmp(true, true, "not_photographable", "modification"), false, "REJECT", ["C2.2"]],
    ["visible normal wear", cmp(true, true, "visible", "normal_wear"), false, "REJECT", ["C2.3"]],
    ["np normal wear", cmp(true, true, "not_photographable", "normal_wear"), true, "REJECT", ["C2.3"]],
    ["visible defect", cmp(true, true, "visible", "manufacturing_defect"), false, "REPAIR", ["C2.1", "C3.1"]],
    ["visible defect DOA", cmp(true, true, "visible", "manufacturing_defect"), true, "REPLACE", ["C2.1", "C3.2"]],
    ["np defect", cmp(true, true, "not_photographable", "manufacturing_defect"), false, "REPAIR", ["C4.3", "C3.1"]],
    ["np no damage DOA", cmp(true, true, "not_photographable", "no_visible_damage"), true, "REPLACE", ["C4.3", "C3.2"]],
    ["np no damage", cmp(true, true, "not_photographable", "no_visible_damage"), false, "REPAIR", ["C4.3", "C3.1"]],
  ];
  it.each(rows)("%s", (_n, answers, doa, decision, clauses) => {
    const f = facts(doa);
    const d = expectValid("COMPLAINT", mapToDecision("COMPLAINT", f, answers), f);
    expect(d.decision).toBe(decision);
    expect(d.citedClauses).toEqual(clauses);
    expect(d.nextSteps.join(" ")).toContain("C6");
  });
  it("visible + no_visible_damage is UNMAPPED", () => {
    expect(mapToDecision("COMPLAINT", facts(), cmp(true, true, "visible", "no_visible_damage"))).toBe("UNMAPPED");
  });
  it("unknown option values are UNMAPPED", () => {
    expect(mapToDecision("COMPLAINT", facts(), cmp(true, true, "maybe", "impact"))).toBe("UNMAPPED");
    expect(mapToDecision("COMPLAINT", facts(), cmp(true, true, "visible", "alien"))).toBe("UNMAPPED");
  });
});

describe("fail closed", () => {
  it("missing answer, refusal, wrong value type, expired window", () => {
    expect(mapToDecision("RETURN", facts(), ret(true, true, 0).slice(0, 2))).toBe("UNMAPPED");
    expect(mapToDecision("RETURN", facts(), [])).toBe("UNMAPPED");
    const refused: LunaAnswer = { key: "photo_assessable", type: "refusal", value: null, certainty: null };
    expect(mapToDecision("RETURN", facts(), [noul("device_matches", true), refused, score(0)])).toBe("UNMAPPED");
    const badType: LunaAnswer = { key: "device_matches", type: "noul", value: "true", certainty: 0.9 };
    expect(mapToDecision("RETURN", facts(), [badType, noul("photo_assessable", true), score(0)])).toBe("UNMAPPED");
    const badScore: LunaAnswer = { key: "signs_of_use", type: "score", value: "0", certainty: 0.9 };
    expect(mapToDecision("RETURN", facts(), [noul("device_matches", true), noul("photo_assessable", true), badScore])).toBe("UNMAPPED");
    const badChoice: LunaAnswer = { key: "damage_cause", type: "choice", value: 3, certainty: 0.9 };
    expect(mapToDecision("COMPLAINT", facts(), [...cmp(true, true, "visible", "impact").slice(0, 3), badChoice])).toBe("UNMAPPED");
    expect(mapToDecision("RETURN", facts(false, false), ret(true, true, 0))).toBe("UNMAPPED");
  });
});
