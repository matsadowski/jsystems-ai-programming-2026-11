// Deterministic mapping of certain Luna answers to a policy decision (ADR 004 §4.4). Pure.
import type { CaseType } from "@/lib/shared";
import type { Decision, DecisionFacts, DecisionValue, LunaAnswer } from "@/server/domain/case";

type Draft = Pick<Decision, "decision" | "citedClauses" | "justification" | "missingEvidence"> & {
  steps: string[];
};

const valueOf = (answers: LunaAnswer[], key: string, type: LunaAnswer["type"]) => {
  const a = answers.find((x) => x.key === key);
  return a?.type === type ? a.value : null;
};

const RETURN_R6 = [
  "Klient pakuje urządzenie wraz ze wszystkimi otrzymanymi akcesoriami (pkt R6).",
  "Klient wysyła urządzenie w ciągu 14 dni od zarejestrowania zwrotu (pkt R6).",
  "Zwrot środków na pierwotną metodę płatności w ciągu 14 dni od otrzymania oświadczenia o zwrocie (pkt R6).",
];

function mapReturn(answers: LunaAnswer[]): Draft | null {
  const dm = valueOf(answers, "device_matches", "noul");
  const pa = valueOf(answers, "photo_assessable", "noul");
  const level = valueOf(answers, "signs_of_use", "score");
  if (typeof dm !== "boolean" || typeof pa !== "boolean" || typeof level !== "number") return null;
  const review = (evidence: string, why: string): Draft => ({
    decision: "NEEDS_MANUAL_REVIEW",
    citedClauses: ["R4.1"],
    justification: [why],
    missingEvidence: [evidence],
    steps: ["Przekaż zgłoszenie do oceny pracownika i poproś klienta o lepsze zdjęcie (pkt R4.1)."],
  });
  if (!dm) return review("Zdjęcie deklarowanego urządzenia", "Zdjęcie nie przedstawia deklarowanego urządzenia (pkt R4.1).");
  if (!pa) return review("Ostrzejsze zdjęcie całego urządzenia", "Zdjęcie nie pozwala ocenić stanu urządzenia (pkt R4.1).");
  if (level === 0 || level === 1) {
    return {
      decision: "ACCEPT",
      citedClauses: ["R1.1", "R2.1", "R2.2"],
      justification: [
        "Zgłoszenie mieści się w terminie zwrotu (pkt R1.1).",
        "Na zdjęciu nie widać śladów użytkowania poza oznakami rozpakowania (pkt R2.1, R2.2).",
      ],
      missingEvidence: [],
      steps: RETURN_R6,
    };
  }
  if (level === 2) {
    return {
      decision: "NEEDS_MANUAL_REVIEW",
      citedClauses: ["R2.3"],
      justification: ["Widoczne jest lekkie zużycie; możliwa ocena częściowego zwrotu (pkt R2.3)."],
      missingEvidence: ["Ocena pracownika dotycząca częściowego zwrotu środków"],
      steps: ["Przekaż zgłoszenie do oceny pracownika w sprawie częściowego zwrotu (pkt R2.3)."],
    };
  }
  if (level === 3) {
    return {
      decision: "REJECT",
      citedClauses: ["R2.1", "R2.3"],
      justification: ["Na zdjęciu widoczne jest wyraźne zużycie lub uszkodzenie (pkt R2.1, R2.3)."],
      missingEvidence: [],
      steps: ["Poinformuj klienta, że zwrot został odrzucony z powodu zużycia sprzętu (pkt R2.3)."],
    };
  }
  return null;
}

const DAMAGE_REJECT: Record<string, string> = { impact: "uderzeniem", liquid_or_heat: "cieczą lub wysoką temperaturą", modification: "ingerencją w urządzenie" };

function mapComplaint(answers: LunaAnswer[], facts: DecisionFacts): Draft | null {
  const dm = valueOf(answers, "device_matches", "noul");
  const pa = valueOf(answers, "photo_assessable", "noul");
  const dv = valueOf(answers, "defect_visibility", "choice");
  const dc = valueOf(answers, "damage_cause", "choice");
  if (typeof dm !== "boolean" || typeof pa !== "boolean" || typeof dv !== "string" || typeof dc !== "string") return null;
  const review = (evidence: string, why: string): Draft => ({
    decision: "NEEDS_MANUAL_REVIEW",
    citedClauses: ["C4.2"],
    justification: [why],
    missingEvidence: [evidence],
    steps: ["Przekaż zgłoszenie do oceny pracownika lub skieruj urządzenie do oględzin (pkt C4.2)."],
  });
  if (!dm || !pa) {
    return review("Wyraźne zdjęcie deklarowanego urządzenia", "Zdjęcie nie pozwala potwierdzić urządzenia ani ocenić wady (pkt C4.2).");
  }
  if (dv === "not_visible") {
    return review("Zdjęcie pokazujące opisaną wadę lub oględziny urządzenia", "Opisana wada nie jest widoczna na zdjęciu (pkt C4.2).");
  }
  if (dv !== "visible" && dv !== "not_photographable") return null;
  if (dc in DAMAGE_REJECT) {
    return {
      decision: "REJECT",
      citedClauses: ["C2.2"],
      justification: [`Uszkodzenie jest spowodowane ${DAMAGE_REJECT[dc]} i nie jest objęte reklamacją (pkt C2.2).`],
      missingEvidence: [],
      steps: ["Poinformuj klienta o odrzuceniu reklamacji z powodu uszkodzenia użytkowego (pkt C2.2)."],
    };
  }
  if (dc === "normal_wear") {
    return {
      decision: "REJECT",
      citedClauses: ["C2.3"],
      justification: ["Widoczne ślady to normalne zużycie, które nie jest wadą (pkt C2.3)."],
      missingEvidence: [],
      steps: ["Poinformuj klienta o odrzuceniu reklamacji z powodu normalnego zużycia (pkt C2.3)."],
    };
  }
  const covered = dc === "manufacturing_defect" || (dv === "not_photographable" && dc === "no_visible_damage");
  if (!covered) return null;
  const doa = facts.deadOnArrivalWindow;
  const decision: DecisionValue = doa ? "REPLACE" : "REPAIR";
  const remedy = doa ? "C3.2" : "C3.1";
  const basis = dv === "visible" ? "C2.1" : "C4.3";
  return {
    decision,
    citedClauses: [basis, remedy],
    justification: [
      dv === "visible"
        ? "Widoczna wada ma charakter fabryczny i jest objęta reklamacją (pkt C2.1)."
        : "Wada nie jest możliwa do sfotografowania, a na zdjęciu nie widać wykluczających uszkodzeń (pkt C4.3).",
      doa
        ? "Wada zgłoszona w ciągu 14 dni od zakupu, zalecana wymiana (pkt C3.2)."
        : "Zalecaną formą rozpatrzenia jest naprawa (pkt C3.1).",
    ],
    missingEvidence: [],
    steps: [
      "Klient wysyła urządzenie do serwisu; wysyłka jest bezpłatna (pkt C6).",
    ],
  };
}

export function mapToDecision(
  caseType: CaseType,
  facts: DecisionFacts,
  answers: LunaAnswer[],
): Decision | "UNMAPPED" {
  if (!facts.withinWindow) return "UNMAPPED";
  const draft = caseType === "RETURN" ? mapReturn(answers) : mapComplaint(answers, facts);
  if (!draft) return "UNMAPPED";
  const { steps, ...rest } = draft;
  const nextSteps =
    caseType === "COMPLAINT"
      ? [...steps, "Odpowiedź na reklamację w ciągu 14 dni kalendarzowych od jej otrzymania (pkt C6)."]
      : steps;
  return { ...rest, nextSteps, confidence: "HIGH", source: "FAST", violationsOnFirstAttempt: [] };
}
