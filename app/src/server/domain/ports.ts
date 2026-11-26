// Injected function types between modules. The router (ADR 004) and the case services receive
// these instead of importing concrete AI/Luna modules, so tests pass typed fakes.
import type { CaseInput } from "@/lib/shared/case-input";
import type {
  Case,
  Decision,
  DecisionFacts,
  ImageAnalysis,
  LunaAssessment,
  ProcessedImage,
} from "./case";

export interface AnalyzeImageArgs {
  input: CaseInput;
  image: ProcessedImage;
  signal?: AbortSignal;
}
/** Vision LLM step (ADR 002 analyst). Throws AiTimeoutError / AiUnavailableError / AiInvalidOutputError. */
export type AnalyzeImage = (args: AnalyzeImageArgs) => Promise<ImageAnalysis>;

export interface DecideArgs {
  input: CaseInput;
  analysis: ImageAnalysis;
  facts: DecisionFacts;
  /** Present only on `LLM_ESCALATED` (ADR 004 §4.5). */
  preliminary?: LunaAssessment;
  signal?: AbortSignal;
}
/** Decision LLM step with guardrails, corrective retry and fallback (ADR 002 §5). */
export type DecideWithLlm = (args: DecideArgs) => Promise<Decision>;

export interface AssessWithLunaArgs {
  caseId: string;
  input: CaseInput;
  image: ProcessedImage;
  signal?: AbortSignal;
}
/** Luna Decisions call + certainty assessment. Throws LunaUnavailableError. */
export type AssessWithLuna = (args: AssessWithLunaArgs) => Promise<LunaAssessment>;

/** Case repository (ADR 001 §3.4). Implemented in `server/store`. */
export interface CaseRepository {
  /** Stores a new case; purges expired entries and evicts the oldest-accessed over capacity. */
  create(c: Case): void;
  /** Returns the case and refreshes `lastAccessAt`, or `null` if unknown or expired. */
  get(id: string): Case | null;
  /** Atomic read-modify-write; returns the updated case or `null` if unknown or expired. */
  update(id: string, mutator: (c: Case) => Case): Case | null;
  delete(id: string): void;
  size(): number;
  /**
   * Sets `chatInProgress` (with `chatStartedAt`). Returns false while another turn is running.
   * A flag older than 90 s is treated as stale and taken over (auto-expiry).
   */
  tryAcquireChat(id: string): boolean;
  releaseChat(id: string): void;
}
