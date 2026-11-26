// Domain/HTTP error catalogue (ADR 001 §5.4, with fix C6). Messages are Polish and display-ready.
import type { ApiErrorBody, ApiErrorCode } from "@/lib/shared/api";

const AI_RETRY_MESSAGE = "Nie udało się przygotować decyzji. Spróbuj ponownie.";

export const ERROR_DEFINITIONS: Record<ApiErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: "Popraw zaznaczone pola" },
  CASE_NOT_FOUND: { status: 404, message: "Sesja zgłoszenia wygasła. Rozpocznij nowe zgłoszenie." },
  CASE_NOT_DECIDED: { status: 409, message: "Decyzja nie jest jeszcze gotowa." },
  CHAT_BUSY: { status: 409, message: "Poczekaj na zakończenie poprzedniej odpowiedzi." },
  FILE_TOO_LARGE: { status: 413, message: "Plik przekracza limit 10 MB" },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "Dozwolone formaty: JPG, PNG, WEBP" },
  IMAGE_TOO_SMALL: { status: 422, message: "Zdjęcie jest zbyt małe do oceny (min. 200 px)" },
  AI_UNAVAILABLE: { status: 502, message: AI_RETRY_MESSAGE },
  AI_INVALID_OUTPUT: { status: 502, message: AI_RETRY_MESSAGE },
  AI_TIMEOUT: { status: 504, message: AI_RETRY_MESSAGE },
  CONFIG_ERROR: { status: 503, message: "Usługa jest chwilowo niedostępna (błąd konfiguracji)." },
  INTERNAL_ERROR: { status: 500, message: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie." },
};

/** Mid-stream chat error text (ADR 001 §5.3). */
export const CHAT_STREAM_ERROR_MESSAGE = "Nie udało się uzyskać odpowiedzi. Spróbuj ponownie.";

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;
  /** Diagnostic detail for logs only; never sent to the client. */
  readonly detail?: string;

  constructor(
    code: ApiErrorCode,
    options: { fieldErrors?: Record<string, string>; detail?: string; cause?: unknown } = {},
  ) {
    super(ERROR_DEFINITIONS[code].message, { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = ERROR_DEFINITIONS[code].status;
    this.fieldErrors = options.fieldErrors;
    this.detail = options.detail;
  }
}

type Opts = { detail?: string; cause?: unknown };

export class ValidationError extends AppError {
  constructor(fieldErrors: Record<string, string> = {}, opts: Opts = {}) {
    super("VALIDATION_ERROR", { ...opts, fieldErrors });
  }
}
export class CaseNotFoundError extends AppError {
  constructor(opts: Opts = {}) {
    super("CASE_NOT_FOUND", opts);
  }
}
export class CaseNotDecidedError extends AppError {
  constructor(opts: Opts = {}) {
    super("CASE_NOT_DECIDED", opts);
  }
}
export class ChatBusyError extends AppError {
  constructor(opts: Opts = {}) {
    super("CHAT_BUSY", opts);
  }
}
export class FileTooLargeError extends AppError {
  constructor(opts: Opts = {}) {
    super("FILE_TOO_LARGE", opts);
  }
}
export class UnsupportedMediaTypeError extends AppError {
  constructor(opts: Opts = {}) {
    super("UNSUPPORTED_MEDIA_TYPE", opts);
  }
}
export class ImageTooSmallError extends AppError {
  constructor(opts: Opts = {}) {
    super("IMAGE_TOO_SMALL", opts);
  }
}
export class AiUnavailableError extends AppError {
  constructor(opts: Opts = {}) {
    super("AI_UNAVAILABLE", opts);
  }
}
export class AiInvalidOutputError extends AppError {
  constructor(opts: Opts = {}) {
    super("AI_INVALID_OUTPUT", opts);
  }
}
export class AiTimeoutError extends AppError {
  constructor(opts: Opts = {}) {
    super("AI_TIMEOUT", opts);
  }
}
export class ConfigError extends AppError {
  constructor(opts: Opts = {}) {
    super("CONFIG_ERROR", opts);
  }
}
export class InternalError extends AppError {
  constructor(opts: Opts = {}) {
    super("INTERNAL_ERROR", opts);
  }
}

/**
 * Luna Decisions failure (timeout, HTTP error, malformed body). Never surfaced to the client:
 * it escalates in `gated` and is ignored in `shadow` (ADR 004 §5). Deliberately not an AppError.
 */
export class LunaUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LunaUnavailableError";
  }
}

export function errorBody(error: AppError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
  };
}
