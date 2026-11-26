// Domain model of a case (ADR 000 §5, ADR 001 §4, ADR 002 §4.3, ADR 004 §4.5). Types only.
import type { UIMessage } from "ai";
import type { CaseInput } from "@/lib/shared/case-input";
import type { DecisionMode, DecisionPath, DecisionValue } from "@/lib/shared/enums";
import type { DecisionOutput, ImageAnalysis } from "@/server/ai/schemas";

export type { CaseInput, DecisionMode, DecisionPath, DecisionValue, ImageAnalysis };

export type CaseStatus = "ANALYZED" | "DECIDED";

export interface ImageMeta {
  originalFormat: "jpeg" | "png" | "webp";
  originalWidth: number;
  originalHeight: number;
  originalByteSize: number;
  width: number;
  height: number;
  byteSize: number;
}

/** Reduced photo used only for the analysis call. Never stored (ADR 000 §8.5). */
export interface ProcessedImage {
  bytes: Buffer;
  format: "jpeg";
  width: number;
  height: number;
  byteSize: number;
  originalFormat: ImageMeta["originalFormat"];
  originalWidth: number;
  originalHeight: number;
  originalByteSize: number;
}

export interface DecisionFacts {
  submissionDate: string;
  daysSincePurchase: number;
  windowDays: 14 | 730;
  withinWindow: boolean;
  deadOnArrivalWindow: boolean;
}

export type DecisionSource = "MODEL" | "GUARDRAIL" | "CHAT_REVISION" | "RULES" | "FAST";

/** Stored decision: model output (or code-built equivalent) plus provenance. */
export type Decision = Omit<DecisionOutput, "decision"> & {
  decision: DecisionValue;
  source: DecisionSource;
  violationsOnFirstAttempt: string[];
};

export interface DecisionHistoryEntry {
  decision: Decision;
  at: string;
  trigger: "INITIAL" | "CHAT_REVISION";
  messageId?: string;
}

/** Answer value after parsing: boolean (noul), option key (choice) or bucket index (score). */
export interface LunaAnswer {
  key: string;
  type: "noul" | "choice" | "score" | "refusal" | "missing";
  value: boolean | string | number | null;
  certainty: number | null;
  probabilities?: Record<string, number> | number[];
}

export interface LunaAssessment {
  questionsVersion: string;
  answers: LunaAnswer[];
  uncertainKeys: string[];
  refusedKeys: string[];
  latencyMs: number;
  costUsd: number | null;
}

export type ShadowFastResult = DecisionValue | "UNMAPPED" | "NOT_ELIGIBLE" | "UNCERTAIN";

export interface ShadowComparison {
  fastDecision: ShadowFastResult;
  agreesWithLlm: boolean | null;
}

export interface Case {
  id: string;
  status: CaseStatus;
  input: CaseInput;
  imageMeta: ImageMeta;
  /** `null` on `RULES` and `FAST` paths (no vision call). */
  analysis: ImageAnalysis | null;
  facts: DecisionFacts;
  decision: Decision | null;
  decisionHistory: DecisionHistoryEntry[];
  messages: UIMessage[];
  policyVersion: string;
  promptVersions: { vision: string; decision: string; chat: string };
  decisionPath: DecisionPath;
  lunaAssessment: LunaAssessment | null;
  /** Set only in `shadow` mode. */
  shadow: ShadowComparison | null;
  chatInProgress: boolean;
  /** When the busy flag was set; used for auto-expiry (ADR 001 §3.4). */
  chatStartedAt: string | null;
  createdAt: string;
  lastAccessAt: string;
}
