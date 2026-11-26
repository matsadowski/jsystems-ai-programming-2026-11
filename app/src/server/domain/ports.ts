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
  create(c: Case): void;
  get(id: string): Case | null;
  save(c: Case): void;
  /** Sets the busy flag; false if a chat turn is already running (and not expired). */
  tryAcquireChat(id: string): boolean;
  releaseChat(id: string): void;
  size(): number;
}
