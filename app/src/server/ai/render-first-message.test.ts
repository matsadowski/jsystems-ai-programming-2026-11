import { describe, expect, it } from "vitest";
import { COMPLAINT_DECISIONS, RETURN_DECISIONS, decisionLabel } from "@/lib/shared";
import type { Decision, DecisionFacts } from "@/server/domain/case";
import { firstMessageUIMessage, renderFirstMessage } from "./render-first-message";

const DISCLAIMER =
  "Decyzja jest rekomendacją wygenerowaną przez AI na podstawie zdjęcia, danych zgłoszenia i regulaminu. Ostateczną decyzję podejmuje pracownik.";

const facts: DecisionFacts = {
  submissionDate: "2026-11-25",
  daysSincePurchase: 5,
  windowDays: 14,
  withinWindow: true,
  deadOnArrivalWindow: false,
};

const decision = (value: string, o: Partial<Decision> = {}): Decision =>
  ({
    decision: value,
    citedClauses: ["R1.1"],
    justification: ["Pierwszy powód (R1.1).", "Drugi powód."],
    nextSteps: ["Krok pierwszy.", "Krok drugi."],
    missingEvidence: value === "NEEDS_MANUAL_REVIEW" ? ["Brak zdjęcia tabliczki"] : [],
    confidence: "HIGH",
    source: "MODEL",
    violationsOnFirstAttempt: [],
    ...o,
  }) as Decision;

const render = (caseType: "RETURN" | "COMPLAINT", d: Decision) =>
  renderFirstMessage({
    caseType,
    category: "LAPTOP",
    model: "Dell XPS 13",
    purchaseDate: "2026-11-20",
    facts,
    decision: d,
  });

describe("renderFirstMessage", () => {
  const all = [
    ...RETURN_DECISIONS.map((v) => ["RETURN", v] as const),
    ...COMPLAINT_DECISIONS.map((v) => ["COMPLAINT", v] as const),
  ];

  for (const [caseType, value] of all) {
    it(`${caseType} ${value}: sections in order, exact disclaimer`, () => {
      const md = render(caseType, decision(value));
      const label = decisionLabel(caseType, value).label;
      const idx = [
        md.indexOf("Dzień dobry, przeanalizowałem zgłoszenie"),
        md.indexOf(`### Decyzja: ${label}`),
        md.indexOf("Od daty zakupu (20.11.2026) minęło **5 dni**."),
        md.indexOf("#### Uzasadnienie"),
        md.indexOf("#### Kolejne kroki"),
        md.indexOf(`*${DISCLAIMER}*`),
      ];
      expect(idx.every((i) => i >= 0)).toBe(true);
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
      expect(md.trimEnd().endsWith(`*${DISCLAIMER}*`)).toBe(true);
      expect(md.includes("#### Brakujące informacje")).toBe(value === "NEEDS_MANUAL_REVIEW");
    });
  }

  it("greeting names type, category label and model", () => {
    expect(render("RETURN", decision("ACCEPT")).startsWith(
      "Dzień dobry, przeanalizowałem zgłoszenie **Zwrot** dotyczące: Laptop — Dell XPS 13.",
    )).toBe(true);
    expect(render("COMPLAINT", decision("REPAIR")).split("\n")[0]).toContain("**Reklamacja**");
  });

  it("bullets and numbered lists; missing info between justification and next steps", () => {
    const md = render("RETURN", decision("NEEDS_MANUAL_REVIEW"));
    expect(md).toContain("- Pierwszy powód (R1.1).\n- Drugi powód.");
    expect(md).toContain("1. Krok pierwszy.\n2. Krok drugi.");
    expect(md).toContain("#### Brakujące informacje\n\n- Brak zdjęcia tabliczki");
    expect(md.indexOf("#### Uzasadnienie")).toBeLessThan(md.indexOf("#### Brakujące informacje"));
    expect(md.indexOf("#### Brakujące informacje")).toBeLessThan(md.indexOf("#### Kolejne kroki"));
  });

  it("escapes leading # > < in model strings", () => {
    const md = render(
      "RETURN",
      decision("ACCEPT", {
        justification: ["# Fałszywy nagłówek", "  > cytat", "<script>alert(1)</script>"],
        nextSteps: ["# krok"],
      }),
    );
    expect(md).toContain("- \\# Fałszywy nagłówek");
    expect(md).toContain("- \\> cytat");
    expect(md).toContain("- \\<script>alert(1)</script>");
    expect(md).toContain("1. \\# krok");
    expect(md).not.toMatch(/^#+ Fałszywy/m);
    expect(md).not.toMatch(/^\s*<script>/m);
  });

  it("collapses newlines inside a bullet", () => {
    const md = render("RETURN", decision("ACCEPT", { justification: ["linia 1\n\n# nagłówek\r\n- inny"] }));
    expect(md).toContain("- linia 1 # nagłówek - inny");
    expect(md).not.toMatch(/^# nagłówek/m);
  });

  it("escapes missingEvidence too", () => {
    const md = render("RETURN", decision("NEEDS_MANUAL_REVIEW", { missingEvidence: ["> x\ny"] }));
    expect(md).toContain("- \\> x y");
  });
});

describe("firstMessageUIMessage", () => {
  it("wraps markdown in a text part", () => {
    expect(firstMessageUIMessage("m1", "hej")).toEqual({
      id: "m1",
      role: "assistant",
      parts: [{ type: "text", text: "hej" }],
    });
  });
});
