// Client state machine of the single page (ADR 003 §3.1). Pure: no I/O, no object-URL handling —
// CaseApp (T18) performs the API calls, dispatches the results, and revokes the preview URL on RESET.
import type {
  AnalysisDTO,
  AssessmentDTO,
  CaseSummary,
  CreateCaseResponse,
  DecisionDTO,
  DecisionPath,
  TextUIMessage,
} from "@/lib/shared";
import {
  FIELD_ORDER,
  type BannerError,
  type FieldErrors,
  type FieldKey,
  type FormValues,
  type PhotoState,
} from "./form/types";

/** What the reducer needs from an `ApiError` (structurally compatible with `api/client.ts`). */
export interface ApiFailure {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

interface FormData_ {
  values: FormValues;
  photo: PhotoState | null;
  fieldErrors: FieldErrors;
  bannerError?: BannerError;
}

export type EditingState = FormData_ & {
  status: "editing";
  /** Set after a 502/504 in `deciding`: retry calls only the decision endpoint. */
  pendingCaseId?: string;
  /** The 201 payload belonging to `pendingCaseId`, needed to enter `chat` after a successful retry. */
  pendingCreated?: CreateCaseResponse;
};
export type AnalyzingState = FormData_ & { status: "analyzing" };
export type DecidingState = FormData_ & { status: "deciding"; created: CreateCaseResponse };
export interface ChatState {
  status: "chat";
  caseId: string;
  caseSummary: CaseSummary;
  analysis: AnalysisDTO | null;
  decisionPath: DecisionPath;
  assessment: AssessmentDTO | null;
  decision: DecisionDTO;
  firstMessage: TextUIMessage;
  photoPreviewUrl: string | null;
}

export type CaseAppState = EditingState | AnalyzingState | DecidingState | ChatState;

export type CaseAppAction =
  | { type: "EDIT_VALUES"; patch: Partial<FormValues> }
  | { type: "PHOTO_CHANGED"; photo: PhotoState | null }
  | { type: "SUBMIT" }
  | { type: "CASE_CREATED"; created: CreateCaseResponse }
  | { type: "CASE_FAILED"; error: ApiFailure }
  | { type: "RETRY_DECISION" }
  | { type: "DECISION_SUCCEEDED"; decision: DecisionDTO; firstMessage: TextUIMessage }
  | { type: "DECISION_FAILED"; error: ApiFailure }
  | { type: "DECISION_UPDATED"; decision: DecisionDTO }
  | { type: "RESET" };

export function createInitialState(): CaseAppState {
  return {
    status: "editing",
    values: { model: "", purchaseDate: "", reason: "" },
    photo: null,
    fieldErrors: {},
  };
}

const PHOTO_ERROR_CODES = new Set(["FILE_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "IMAGE_TOO_SMALL"]);

function knownFieldErrors(raw: Record<string, string> | undefined): FieldErrors {
  const out: FieldErrors = {};
  for (const key of FIELD_ORDER) if (raw?.[key]) out[key] = raw[key];
  return out;
}

/** Server failure of `POST /api/cases`: field errors inline, photo-related codes on the photo, else banner. */
function failureToFormFeedback(error: ApiFailure): Pick<FormData_, "fieldErrors" | "bannerError"> {
  const fieldErrors = knownFieldErrors(error.fieldErrors);
  if (error.code && PHOTO_ERROR_CODES.has(error.code)) return { fieldErrors: { ...fieldErrors, photo: error.message } };
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { fieldErrors: {}, bannerError: { message: error.message } };
}

function formData(state: EditingState | AnalyzingState | DecidingState): FormData_ {
  return { values: state.values, photo: state.photo, fieldErrors: state.fieldErrors, bannerError: state.bannerError };
}

function withoutKey(errors: FieldErrors, keys: FieldKey[]): FieldErrors {
  const copy = { ...errors };
  for (const k of keys) delete copy[k];
  return copy;
}

export function caseAppReducer(state: CaseAppState, action: CaseAppAction): CaseAppState {
  switch (action.type) {
    case "EDIT_VALUES": {
      if (state.status !== "editing") return state;
      const changed = Object.keys(action.patch) as FieldKey[];
      // Any edit invalidates the pending case: the changed data must be analysed again.
      return {
        status: "editing",
        values: { ...state.values, ...action.patch },
        photo: state.photo,
        fieldErrors: withoutKey(state.fieldErrors, changed),
      };
    }
    case "PHOTO_CHANGED": {
      if (state.status !== "editing") return state;
      return {
        status: "editing",
        values: state.values,
        photo: action.photo,
        fieldErrors: withoutKey(state.fieldErrors, ["photo"]),
      };
    }
    case "SUBMIT": {
      if (state.status !== "editing") return state;
      return { status: "analyzing", values: state.values, photo: state.photo, fieldErrors: {} };
    }
    case "CASE_CREATED": {
      if (state.status !== "analyzing") return state;
      return { ...formData(state), status: "deciding", created: action.created, bannerError: undefined };
    }
    case "CASE_FAILED": {
      if (state.status !== "analyzing") return state;
      return { status: "editing", values: state.values, photo: state.photo, ...failureToFormFeedback(action.error) };
    }
    case "RETRY_DECISION": {
      if (state.status !== "editing" || !state.pendingCaseId || !state.pendingCreated) return state;
      return {
        status: "deciding",
        values: state.values,
        photo: state.photo,
        fieldErrors: {},
        created: state.pendingCreated,
      };
    }
    case "DECISION_SUCCEEDED": {
      if (state.status !== "deciding") return state;
      const { created } = state;
      return {
        status: "chat",
        caseId: created.caseId,
        caseSummary: created.caseSummary,
        analysis: created.analysis,
        decisionPath: created.decisionPath,
        assessment: created.assessment,
        decision: action.decision,
        firstMessage: action.firstMessage,
        photoPreviewUrl: state.photo?.previewUrl ?? null,
      };
    }
    case "DECISION_FAILED": {
      if (state.status !== "deciding") return state;
      const base = {
        status: "editing" as const,
        values: state.values,
        photo: state.photo,
        fieldErrors: {},
        bannerError: { message: action.error.message },
      };
      // 404: the server forgot the case, so the whole form must be re-submitted.
      if (action.error.status === 404) return base;
      return { ...base, pendingCaseId: state.created.caseId, pendingCreated: state.created };
    }
    case "DECISION_UPDATED": {
      if (state.status !== "chat") return state;
      return { ...state, decision: action.decision };
    }
    case "RESET":
      return createInitialState();
  }
}
