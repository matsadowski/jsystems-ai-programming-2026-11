import { describe, expect, it } from "vitest";
import type { CreateCaseResponse, DecideCaseResponse } from "@/lib/shared";
import {
  caseAppReducer,
  createInitialState,
  type CaseAppState,
  type ApiFailure,
} from "./case-app-reducer";
import type { PhotoState } from "./form/types";

const photo: PhotoState = {
  file: new File(["x"], "phone-1.jpg", { type: "image/jpeg" }),
  previewUrl: "blob:preview-1",
  name: "phone-1.jpg",
  sizeBytes: 1,
};

const created: CreateCaseResponse = {
  caseId: "case-1",
  caseSummary: {
    caseId: "case-1",
    caseType: "RETURN",
    caseTypeLabel: "Zwrot",
    category: "SMARTPHONE",
    categoryLabel: "Smartfon",
    model: "Pixel 9",
    purchaseDate: "2026-11-20",
    reason: "",
  },
  analysis: { summary: "Telefon bez śladów.", photoQuality: "SUFFICIENT", matchesDeclaredCategory: "YES" },
  decisionPath: "LLM",
  assessment: null,
};

const decided: DecideCaseResponse = {
  decision: {
    value: "ACCEPT",
    label: "Zwrot zaakceptowany",
    tone: "positive",
    daysSincePurchase: 6,
    citedClauses: ["R1.1"],
    decisionPath: "LLM",
  },
  firstMessage: { id: "m1", role: "assistant", parts: [{ type: "text", text: "Dzień dobry" }] },
};

const fail = (status: number, extra: Partial<ApiFailure> = {}): ApiFailure => ({
  status,
  code: "AI_TIMEOUT",
  message: "Nie udało się przygotować decyzji. Spróbuj ponownie.",
  ...extra,
});

function filled(): CaseAppState {
  let s = createInitialState();
  s = caseAppReducer(s, {
    type: "EDIT_VALUES",
    patch: { caseType: "RETURN", category: "SMARTPHONE", model: "Pixel 9", purchaseDate: "2026-11-20" },
  });
  return caseAppReducer(s, { type: "PHOTO_CHANGED", photo });
}

function analyzing(): CaseAppState {
  return caseAppReducer(filled(), { type: "SUBMIT" });
}

function deciding(): CaseAppState {
  return caseAppReducer(analyzing(), { type: "CASE_CREATED", created });
}

function editingWithPending(): CaseAppState {
  return caseAppReducer(deciding(), { type: "DECISION_FAILED", error: fail(504) });
}

describe("caseAppReducer", () => {
  it("starts in an empty editing state with nothing preselected", () => {
    const s = createInitialState();
    expect(s.status).toBe("editing");
    if (s.status !== "editing") return;
    expect(s.values).toEqual({ model: "", purchaseDate: "", reason: "" });
    expect(s.photo).toBeNull();
    expect(s.pendingCaseId).toBeUndefined();
  });

  it("editing -> analyzing on SUBMIT keeping data and clearing the banner", () => {
    const s = analyzing();
    expect(s.status).toBe("analyzing");
    if (s.status !== "analyzing") return;
    expect(s.values.model).toBe("Pixel 9");
    expect(s.photo).toBe(photo);
    expect(s.bannerError).toBeUndefined();
  });

  it("ignores edits while analyzing or deciding (form is locked)", () => {
    const a = analyzing();
    expect(caseAppReducer(a, { type: "EDIT_VALUES", patch: { model: "x" } })).toBe(a);
    const d = deciding();
    expect(caseAppReducer(d, { type: "PHOTO_CHANGED", photo: null })).toBe(d);
  });

  it("analyzing -> deciding on 201 holding the created case", () => {
    const s = deciding();
    expect(s.status).toBe("deciding");
    if (s.status !== "deciding") return;
    expect(s.created.caseId).toBe("case-1");
  });

  it("deciding -> chat on 200", () => {
    const s = caseAppReducer(deciding(), { type: "DECISION_SUCCEEDED", ...decided });
    expect(s.status).toBe("chat");
    if (s.status !== "chat") return;
    expect(s.caseId).toBe("case-1");
    expect(s.caseSummary).toEqual(created.caseSummary);
    expect(s.analysis).toEqual(created.analysis);
    expect(s.decision).toEqual(decided.decision);
    expect(s.firstMessage).toEqual(decided.firstMessage);
    expect(s.photoPreviewUrl).toBe("blob:preview-1");
  });

  it("analyzing -> editing with a banner on a 5xx, data and photo kept", () => {
    const s = caseAppReducer(analyzing(), { type: "CASE_FAILED", error: fail(502, { code: "AI_UNAVAILABLE" }) });
    expect(s.status).toBe("editing");
    if (s.status !== "editing") return;
    expect(s.bannerError?.message).toBe("Nie udało się przygotować decyzji. Spróbuj ponownie.");
    expect(s.values.model).toBe("Pixel 9");
    expect(s.photo).toBe(photo);
    expect(s.pendingCaseId).toBeUndefined();
  });

  it("analyzing -> editing with field errors on a 400 (no banner)", () => {
    const s = caseAppReducer(analyzing(), {
      type: "CASE_FAILED",
      error: fail(400, {
        code: "VALIDATION_ERROR",
        message: "Popraw zaznaczone pola",
        fieldErrors: { model: "Podaj nazwę", unknown: "ignored" },
      }),
    });
    if (s.status !== "editing") throw new Error("expected editing");
    expect(s.fieldErrors).toEqual({ model: "Podaj nazwę" });
    expect(s.bannerError).toBeUndefined();
  });

  it("maps photo-related server errors (413/415/422) to the photo field", () => {
    const s = caseAppReducer(analyzing(), {
      type: "CASE_FAILED",
      error: fail(413, { code: "FILE_TOO_LARGE", message: "Plik przekracza limit 10 MB" }),
    });
    if (s.status !== "editing") throw new Error("expected editing");
    expect(s.fieldErrors.photo).toBe("Plik przekracza limit 10 MB");
    expect(s.bannerError).toBeUndefined();
  });

  it("deciding -> editing on 502/504 keeping pendingCaseId and the created case", () => {
    for (const status of [502, 504]) {
      const s = caseAppReducer(deciding(), { type: "DECISION_FAILED", error: fail(status) });
      if (s.status !== "editing") throw new Error("expected editing");
      expect(s.pendingCaseId).toBe("case-1");
      expect(s.bannerError?.message).toContain("Spróbuj ponownie");
      expect(s.photo).toBe(photo);
    }
  });

  it("deciding -> editing on 404 clears pendingCaseId (whole form is re-submitted)", () => {
    const s = caseAppReducer(deciding(), {
      type: "DECISION_FAILED",
      error: fail(404, { code: "CASE_NOT_FOUND", message: "Sesja zgłoszenia wygasła. Rozpocznij nowe zgłoszenie." }),
    });
    if (s.status !== "editing") throw new Error("expected editing");
    expect(s.pendingCaseId).toBeUndefined();
    expect(s.bannerError?.message).toContain("wygasła");
  });

  it("editing with pendingCaseId -> deciding on RETRY_DECISION", () => {
    const s = caseAppReducer(editingWithPending(), { type: "RETRY_DECISION" });
    expect(s.status).toBe("deciding");
    if (s.status !== "deciding") return;
    expect(s.created.caseId).toBe("case-1");
    expect(s.bannerError).toBeUndefined();
  });

  it("RETRY_DECISION without pendingCaseId is a no-op", () => {
    const s = filled();
    expect(caseAppReducer(s, { type: "RETRY_DECISION" })).toBe(s);
  });

  it("editing a value while pendingCaseId is set clears pendingCaseId and the banner", () => {
    const s = caseAppReducer(editingWithPending(), { type: "EDIT_VALUES", patch: { model: "Pixel 10" } });
    if (s.status !== "editing") throw new Error("expected editing");
    expect(s.pendingCaseId).toBeUndefined();
    expect(s.bannerError).toBeUndefined();
    expect(s.values.model).toBe("Pixel 10");
  });

  it("changing the photo while pendingCaseId is set clears pendingCaseId", () => {
    const s = caseAppReducer(editingWithPending(), { type: "PHOTO_CHANGED", photo: null });
    if (s.status !== "editing") throw new Error("expected editing");
    expect(s.pendingCaseId).toBeUndefined();
    expect(s.photo).toBeNull();
  });

  it("editing a field clears only that field's server error", () => {
    let s = caseAppReducer(analyzing(), {
      type: "CASE_FAILED",
      error: fail(400, { fieldErrors: { model: "a", category: "b" } }),
    });
    s = caseAppReducer(s, { type: "EDIT_VALUES", patch: { model: "Pixel 10" } });
    if (s.status !== "editing") throw new Error("expected editing");
    expect(s.fieldErrors).toEqual({ category: "b" });
  });

  it("chat -> empty editing on RESET", () => {
    const chat = caseAppReducer(deciding(), { type: "DECISION_SUCCEEDED", ...decided });
    expect(caseAppReducer(chat, { type: "RESET" })).toEqual(createInitialState());
  });

  it("updates the decision shown in chat on DECISION_UPDATED", () => {
    const chat = caseAppReducer(deciding(), { type: "DECISION_SUCCEEDED", ...decided });
    const updated = { ...decided.decision, value: "REJECT" as const, label: "Zwrot odrzucony", tone: "negative" as const };
    const s = caseAppReducer(chat, { type: "DECISION_UPDATED", decision: updated });
    if (s.status !== "chat") throw new Error("expected chat");
    expect(s.decision).toEqual(updated);
  });

  it("ignores events that do not apply to the current state", () => {
    const s = createInitialState();
    expect(caseAppReducer(s, { type: "CASE_CREATED", created })).toBe(s);
    expect(caseAppReducer(s, { type: "DECISION_SUCCEEDED", ...decided })).toBe(s);
  });
});
