import { describe, expect, it } from "vitest";
import { makeCaseInputSchema, type CaseInput } from "./case-input";

const TODAY = "2026-11-25";
const schema = makeCaseInputSchema(TODAY);

const valid = {
  caseType: "RETURN",
  category: "SMARTPHONE",
  model: "  Pixel 9  ",
  purchaseDate: TODAY,
  reason: "",
};

function fieldErrors(input: unknown) {
  const r = schema.safeParse(input);
  if (r.success) return {};
  return Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("CaseInputSchema (ADR 001 §3.2, PRD AC-01–AC-06)", () => {
  it("accepts a valid return with an empty reason and today's date, trimming the model", () => {
    const r = schema.parse(valid) as CaseInput;
    expect(r).toEqual({ ...valid, model: "Pixel 9" });
  });

  it("requires case type and category with Polish messages", () => {
    expect(fieldErrors({ ...valid, caseType: undefined }).caseType).toBe("Wybierz typ zgłoszenia");
    expect(fieldErrors({ ...valid, category: "FRIDGE" }).category).toBe(
      "Wybierz kategorię sprzętu",
    );
  });

  it("accepts every AC-03 category", () => {
    for (const c of [
      "LAPTOP", "SMARTPHONE", "TABLET", "MONITOR_TV", "AUDIO", "CAMERA", "WEARABLE",
      "GAME_CONSOLE", "OTHER",
    ]) {
      expect(schema.safeParse({ ...valid, category: c }).success).toBe(true);
    }
  });

  it("model must be 2–100 chars after trimming (AC-04)", () => {
    const msg = "Podaj nazwę lub model (2–100 znaków)";
    expect(fieldErrors({ ...valid, model: " a " }).model).toBe(msg);
    expect(fieldErrors({ ...valid, model: "x".repeat(101) }).model).toBe(msg);
    expect(fieldErrors({ ...valid, model: "ab" }).model).toBeUndefined();
    expect(fieldErrors({ ...valid, model: "x".repeat(100) }).model).toBeUndefined();
  });

  it("complaint reason needs ≥10 chars, whitespace padding not counted (AC-06)", () => {
    const msg = "Opisz powód reklamacji (min. 10 znaków)";
    expect(fieldErrors({ ...valid, caseType: "COMPLAINT", reason: "123456789" }).reason).toBe(msg);
    expect(
      fieldErrors({ ...valid, caseType: "COMPLAINT", reason: "   123456789   " }).reason,
    ).toBe(msg);
    expect(
      fieldErrors({ ...valid, caseType: "COMPLAINT", reason: "1234567890" }).reason,
    ).toBeUndefined();
  });

  it("reports the complaint reason error even when another field is invalid", () => {
    expect(
      fieldErrors({ ...valid, caseType: "COMPLAINT", reason: "krótko", category: undefined }),
    ).toMatchObject({
      category: "Wybierz kategorię sprzętu",
      reason: "Opisz powód reklamacji (min. 10 znaków)",
    });
  });

  it("reason is at most 2000 chars in both case types", () => {
    expect(fieldErrors({ ...valid, reason: "x".repeat(2001) }).reason).toBe(
      "Maksymalnie 2000 znaków",
    );
    expect(fieldErrors({ ...valid, reason: "x".repeat(2000) }).reason).toBeUndefined();
  });

  it("rejects a future purchase date (AC-05)", () => {
    expect(fieldErrors({ ...valid, purchaseDate: "2026-11-26" }).purchaseDate).toBe(
      "Data zakupu nie może być z przyszłości",
    );
  });

  it("requires a real calendar date ≥ 2000-01-01", () => {
    const msg = "Podaj datę zakupu";
    expect(fieldErrors({ ...valid, purchaseDate: "" }).purchaseDate).toBe(msg);
    expect(fieldErrors({ ...valid, purchaseDate: "2026-02-30" }).purchaseDate).toBe(msg);
    expect(fieldErrors({ ...valid, purchaseDate: "1999-12-31" }).purchaseDate).toBe(msg);
    expect(fieldErrors({ ...valid, purchaseDate: "25.11.2026" }).purchaseDate).toBe(msg);
    expect(fieldErrors({ ...valid, purchaseDate: "2000-01-01" }).purchaseDate).toBeUndefined();
  });

  it("accepts an old date outside the policy window (guardrails decide, not validation)", () => {
    expect(schema.safeParse({ ...valid, purchaseDate: "2020-01-01" }).success).toBe(true);
  });
});
