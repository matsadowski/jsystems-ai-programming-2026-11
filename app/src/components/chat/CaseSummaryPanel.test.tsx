// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AnalysisDTO, AssessmentDTO, CaseSummary, DecisionDTO } from "@/lib/shared";
import { CaseSummaryPanel } from "./CaseSummaryPanel";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const caseSummary: CaseSummary = {
  caseId: "c1",
  caseType: "RETURN",
  caseTypeLabel: "Zwrot",
  category: "SMARTPHONE",
  categoryLabel: "Smartfon",
  model: "Galaxy S24",
  purchaseDate: "2026-11-22",
  reason: "Nie pasuje",
};
const decision = (decisionPath: DecisionDTO["decisionPath"]): DecisionDTO => ({
  value: "ACCEPT",
  label: "Zwrot zaakceptowany",
  tone: "positive",
  daysSincePurchase: 3,
  citedClauses: ["R1.1"],
  decisionPath,
});
const analysis: AnalysisDTO = { summary: "Telefon bez widocznych uszkodzeń.", photoQuality: "SUFFICIENT", matchesDeclaredCategory: "YES" };
const assessment: AssessmentDTO = {
  items: [
    { key: "usage", label: "Ślady użytkowania", answerLabel: "brak", certaintyPct: 93, certain: true },
    { key: "pack", label: "Opakowanie", answerLabel: "niejasne", certaintyPct: 41, certain: false },
  ],
  uncertainKeys: ["pack"],
};
const render1 = (path: DecisionDTO["decisionPath"], a: AnalysisDTO | null, s: AssessmentDTO | null) =>
  render(
    <CaseSummaryPanel caseSummary={caseSummary} analysis={a} assessment={s} decision={decision(path)} photoPreviewUrl="blob:x" />,
  );

describe("CaseSummaryPanel", () => {
  it("shows the case fields, days, badge and path label", () => {
    render1("LLM", analysis, null);
    expect(screen.getByText("Zwrot")).toBeInTheDocument();
    expect(screen.getByText("Smartfon")).toBeInTheDocument();
    expect(screen.getByText("Galaxy S24")).toBeInTheDocument();
    expect(screen.getByText(/22\.11\.2026/)).toBeInTheDocument();
    expect(screen.getByText(/3 dni temu/)).toBeInTheDocument();
    expect(screen.getByText("Zwrot zaakceptowany")).toBeInTheDocument();
    expect(screen.getByText("Pełna analiza AI")).toBeInTheDocument();
  });

  it("LLM: AI photo description", () => {
    render1("LLM", analysis, null);
    expect(screen.getByText("Opis zdjęcia (AI)")).toBeInTheDocument();
    expect(screen.getByText("Telefon bez widocznych uszkodzeń.")).toBeInTheDocument();
    expect(screen.queryByText("Ocena automatyczna")).not.toBeInTheDocument();
  });

  it("FAST: automatic assessment rows", () => {
    render1("FAST", null, assessment);
    expect(screen.getByText("Ocena automatyczna")).toBeInTheDocument();
    expect(screen.getByText("Ślady użytkowania: brak — 93%")).toBeInTheDocument();
    expect(screen.queryByText("Opis zdjęcia (AI)")).not.toBeInTheDocument();
  });

  it("LLM_ESCALATED: description plus uncertain items", () => {
    render1("LLM_ESCALATED", analysis, assessment);
    expect(screen.getByText("Opis zdjęcia (AI)")).toBeInTheDocument();
    expect(screen.getByText(/Opakowanie: niejasne — 41%/)).toBeInTheDocument();
    expect(screen.queryByText(/Ślady użytkowania: brak/)).not.toBeInTheDocument();
  });

  it("RULES: photo not analysed", () => {
    render1("RULES", null, null);
    expect(screen.getByText("Zdjęcie nie było analizowane — termin minął")).toBeInTheDocument();
  });

  it("thumbnail click opens an enlarged dialog", async () => {
    const { container } = render1("LLM", analysis, null);
    await userEvent.click(screen.getByRole("button", { name: /Powiększ zdjęcie/ }));
    expect(container.querySelector("dialog")).toHaveAttribute("open");
  });
});

afterEach(cleanup);
