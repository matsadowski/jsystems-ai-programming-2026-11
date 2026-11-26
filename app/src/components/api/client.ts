// Browser API client (ADR 003 §3.3, §5). Never imports server code.
import type {
  ApiErrorBody,
  ApiErrorCode,
  CaseInput,
  CreateCaseResponse,
  DecideCaseResponse,
} from "@/lib/shared";

export const CREATE_CASE_TIMEOUT_MS = 30_000;
export const DECIDE_CASE_TIMEOUT_MS = 40_000;

/** Same text as the server's 502/504 message (PRD AC-33): a client timeout shows the 504 banner. */
export const AI_FAILURE_MESSAGE = "Nie udało się przygotować decyzji. Spróbuj ponownie.";
const NETWORK_MESSAGE = "Nie udało się połączyć z serwerem. Spróbuj ponownie.";
const UNEXPECTED_MESSAGE = "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: ApiErrorCode, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface RequestOptions {
  /** Override the client abort (tests). */
  timeoutMs?: number;
}

async function request<T>(url: string, body: BodyInit | undefined, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted) throw new ApiError(504, "AI_TIMEOUT", AI_FAILURE_MESSAGE);
    void cause;
    throw new ApiError(0, "INTERNAL_ERROR", NETWORK_MESSAGE);
  } finally {
    clearTimeout(timer);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }

  if (!response.ok) {
    const err = (json as Partial<ApiErrorBody> | undefined)?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? UNEXPECTED_MESSAGE,
      err?.fieldErrors ?? {},
    );
  }
  if (json === undefined) throw new ApiError(response.status, "INTERNAL_ERROR", UNEXPECTED_MESSAGE);
  return json as T;
}

/** `POST /api/cases` as multipart; enum values are sent as constants, never as Polish labels. */
export function createCase(values: CaseInput, photo: File, options: RequestOptions = {}): Promise<CreateCaseResponse> {
  const form = new FormData();
  form.set("caseType", values.caseType);
  form.set("category", values.category);
  form.set("model", values.model);
  form.set("purchaseDate", values.purchaseDate);
  form.set("reason", values.reason);
  form.set("photo", photo, photo.name);
  return request<CreateCaseResponse>("/api/cases", form, options.timeoutMs ?? CREATE_CASE_TIMEOUT_MS);
}

/** `POST /api/cases/{id}/decision` with an empty body. */
export function decideCase(caseId: string, options: RequestOptions = {}): Promise<DecideCaseResponse> {
  return request<DecideCaseResponse>(
    `/api/cases/${encodeURIComponent(caseId)}/decision`,
    undefined,
    options.timeoutMs ?? DECIDE_CASE_TIMEOUT_MS,
  );
}
