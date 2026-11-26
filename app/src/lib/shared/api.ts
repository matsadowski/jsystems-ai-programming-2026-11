// API DTOs shared by the server routes and the client (ADR 001 §4.3, §5; ADR 004 §5).
import type {
  CaseType,
  DecisionPath,
  DecisionTone,
  DecisionValue,
  DeviceCategory,
  MatchesCategory,
  PhotoQuality,
} from "./enums";

export interface CaseSummary {
  caseId: string;
  caseType: CaseType;
  caseTypeLabel: string;
  category: DeviceCategory;
  categoryLabel: string;
  model: string;
  purchaseDate: string;
  reason: string;
}

/** `null` on the `RULES` and `FAST` paths, where no vision analysis runs (ADR 004 §4.6). */
export interface AnalysisDTO {
  summary: string;
  photoQuality: PhotoQuality;
  matchesDeclaredCategory: MatchesCategory;
}

/** One Luna answer for display (ADR 004 §5): Polish label + certainty percentage. */
export interface AssessmentItemDTO {
  key: string;
  label: string;
  answerLabel: string;
  certaintyPct: number | null;
  certain: boolean;
}

export interface AssessmentDTO {
  items: AssessmentItemDTO[];
  uncertainKeys: string[];
}

export interface CreateCaseResponse {
  caseId: string;
  caseSummary: CaseSummary;
  analysis: AnalysisDTO | null;
  decisionPath: DecisionPath;
  assessment: AssessmentDTO | null;
}

export interface DecisionDTO {
  value: DecisionValue;
  label: string;
  tone: DecisionTone;
  daysSincePurchase: number;
  citedClauses: string[];
  decisionPath: DecisionPath;
}

export interface TextUIMessage {
  id: string;
  role: "assistant" | "user";
  parts: { type: "text"; text: string }[];
}

export interface DecideCaseResponse {
  decision: DecisionDTO;
  firstMessage: TextUIMessage;
}

/** Finish metadata of a chat stream (ADR 001 §5.3). */
export interface ChatMessageMetadata {
  decision?: DecisionDTO;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "CASE_NOT_FOUND"
  | "CASE_NOT_DECIDED"
  | "CHAT_BUSY"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "IMAGE_TOO_SMALL"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_OUTPUT"
  | "AI_TIMEOUT"
  | "CONFIG_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; fieldErrors?: Record<string, string> };
}

/** The `reviseDecision` tool output, visible to the client as a tool part (ADR 002 §4.5). */
export type ReviseDecisionResult =
  | { ok: true; from: DecisionValue; to: DecisionValue; fromLabel: string; toLabel: string }
  | {
      ok: false;
      error:
        | "SAME_DECISION"
        | "NOT_ALLOWED_FOR_CASE_TYPE"
        | "WINDOW_EXPIRED"
        | "UNKNOWN_CLAUSE"
        | "EVIDENCE_CONTRADICTS";
    };
