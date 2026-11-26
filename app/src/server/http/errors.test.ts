import { describe, expect, it } from "vitest";
import {
  AppError,
  CaseNotDecidedError,
  ChatBusyError,
  ERROR_DEFINITIONS,
  ValidationError,
  errorBody,
} from "./errors";

describe("AppError catalogue (ADR 001 §5.4 with fix C6)", () => {
  it("maps every code to its HTTP status and Polish message", () => {
    expect(ERROR_DEFINITIONS).toMatchObject({
      VALIDATION_ERROR: { status: 400, message: "Popraw zaznaczone pola" },
      CASE_NOT_FOUND: { status: 404, message: "Sesja zgłoszenia wygasła. Rozpocznij nowe zgłoszenie." },
      CASE_NOT_DECIDED: { status: 409, message: "Decyzja nie jest jeszcze gotowa." },
      CHAT_BUSY: { status: 409, message: "Poczekaj na zakończenie poprzedniej odpowiedzi." },
      FILE_TOO_LARGE: { status: 413, message: "Plik przekracza limit 10 MB" },
      UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "Dozwolone formaty: JPG, PNG, WEBP" },
      IMAGE_TOO_SMALL: { status: 422, message: "Zdjęcie jest zbyt małe do oceny (min. 200 px)" },
      AI_UNAVAILABLE: { status: 502, message: "Nie udało się przygotować decyzji. Spróbuj ponownie." },
      AI_INVALID_OUTPUT: { status: 502, message: "Nie udało się przygotować decyzji. Spróbuj ponownie." },
      AI_TIMEOUT: { status: 504, message: "Nie udało się przygotować decyzji. Spróbuj ponownie." },
      CONFIG_ERROR: { status: 503, message: "Usługa jest chwilowo niedostępna (błąd konfiguracji)." },
      INTERNAL_ERROR: { status: 500, message: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." },
    });
  });

  it("subclasses carry code, status and message", () => {
    const busy = new ChatBusyError();
    expect(busy).toBeInstanceOf(AppError);
    expect([busy.code, busy.status, busy.message]).toEqual([
      "CHAT_BUSY",
      409,
      "Poczekaj na zakończenie poprzedniej odpowiedzi.",
    ]);
    expect(new CaseNotDecidedError().message).toBe("Decyzja nie jest jeszcze gotowa.");
  });

  it("serializes to { error: { code, message, fieldErrors? } }", () => {
    expect(errorBody(new ValidationError({ model: "Podaj nazwę lub model (2–100 znaków)" }))).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Popraw zaznaczone pola",
        fieldErrors: { model: "Podaj nazwę lub model (2–100 znaków)" },
      },
    });
    expect(errorBody(new ChatBusyError())).toEqual({
      error: { code: "CHAT_BUSY", message: "Poczekaj na zakończenie poprzedniej odpowiedzi." },
    });
  });
});
