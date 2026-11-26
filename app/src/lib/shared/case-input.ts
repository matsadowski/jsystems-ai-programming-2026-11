// Shared form schema (ADR 001 §3.2). Runs on the client and the server; the server is
// authoritative. "Today" is injected so the rule "≤ today in APP_TIMEZONE" stays testable.
import { z } from "zod";
import { compareIsoDates, isValidIsoDate } from "./dates";
import { CASE_TYPES, DEVICE_CATEGORIES } from "./enums";
import {
  COMPLAINT_REASON_MIN_LENGTH,
  MIN_PURCHASE_DATE,
  MODEL_MAX_LENGTH,
  MODEL_MIN_LENGTH,
  REASON_MAX_LENGTH,
} from "./limits";

export const VALIDATION_MESSAGES = {
  caseType: "Wybierz typ zgłoszenia",
  category: "Wybierz kategorię sprzętu",
  model: `Podaj nazwę lub model (${MODEL_MIN_LENGTH}–${MODEL_MAX_LENGTH} znaków)`,
  purchaseDateRequired: "Podaj datę zakupu",
  purchaseDateFuture: "Data zakupu nie może być z przyszłości",
  reasonComplaint: `Opisz powód reklamacji (min. ${COMPLAINT_REASON_MIN_LENGTH} znaków)`,
  reasonMax: `Maksymalnie ${REASON_MAX_LENGTH} znaków`,
  photoRequired: "Dodaj zdjęcie sprzętu",
  photoFormat: "Dozwolone formaty: JPG, PNG, WEBP",
  photoSize: "Plik przekracza limit 10 MB",
} as const;

export const CASE_INPUT_FIELDS = ["caseType", "category", "model", "purchaseDate", "reason"] as const;
export type CaseInputField = (typeof CASE_INPUT_FIELDS)[number];

export function makeCaseInputSchema(today: string) {
  return z
    .object({
      caseType: z.enum(CASE_TYPES, { error: VALIDATION_MESSAGES.caseType }),
      category: z.enum(DEVICE_CATEGORIES, { error: VALIDATION_MESSAGES.category }),
      model: z
        .string({ error: VALIDATION_MESSAGES.model })
        .trim()
        .min(MODEL_MIN_LENGTH, VALIDATION_MESSAGES.model)
        .max(MODEL_MAX_LENGTH, VALIDATION_MESSAGES.model),
      purchaseDate: z
        .string({ error: VALIDATION_MESSAGES.purchaseDateRequired })
        .refine(
          (v) => isValidIsoDate(v) && compareIsoDates(v, MIN_PURCHASE_DATE) >= 0,
          VALIDATION_MESSAGES.purchaseDateRequired,
        )
        .refine(
          (v) => !isValidIsoDate(v) || compareIsoDates(v, today) <= 0,
          VALIDATION_MESSAGES.purchaseDateFuture,
        ),
      reason: z
        .string()
        .trim()
        .max(REASON_MAX_LENGTH, VALIDATION_MESSAGES.reasonMax)
        .default(""),
    })
    .superRefine((input, ctx) => {
      if (input.caseType === "COMPLAINT" && input.reason.length < COMPLAINT_REASON_MIN_LENGTH) {
        ctx.addIssue({
          code: "custom",
          path: ["reason"],
          message: VALIDATION_MESSAGES.reasonComplaint,
        });
      }
    });
}

export type CaseInput = z.output<ReturnType<typeof makeCaseInputSchema>>;

/** First error message per field, for `fieldErrors` in API responses and inline UI errors. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
