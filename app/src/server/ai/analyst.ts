// Vision step (ADR 002 §3.3, §8.3): one `generateText` call with a structured output.
// Throws only AppError subclasses (AiTimeoutError / AiUnavailableError / AiInvalidOutputError).
import "server-only";
import { Output, generateText } from "ai";
import { logger } from "@/server/log/logger";
import type { AnalyzeImageArgs, ImageAnalysis } from "@/server/domain";
import { toAppAiError } from "./errors";
import { visionModel } from "./models";
import { caseFormText } from "./prompt-inputs";
import { loadPrompt } from "./prompts/load-prompt";
import { ComplaintImageAnalysisSchema, ReturnImageAnalysisSchema } from "./schemas";

export const VISION_BUDGET_MS = 20_000;

export interface AnalyzeOptions {
  /** Overrides the 20 s budget (tests). */
  timeoutMs?: number;
}

/** Employee text must not be able to close or open our delimiters. */
const neutralise = (text: string) => text.replace(/</g, "&lt;");

export async function analyzeImage(args: AnalyzeImageArgs, options: AnalyzeOptions = {}): Promise<ImageAnalysis> {
  const { input, image, signal } = args;
  const isReturn = input.caseType === "RETURN";
  const prompt = loadPrompt(isReturn ? "vision-return" : "vision-complaint", {
    case_form: caseFormText(input),
    employee_reason: input.reason ? neutralise(input.reason) : "(none)",
  });
  const budget = AbortSignal.timeout(options.timeoutMs ?? VISION_BUDGET_MS);
  const started = Date.now();
  try {
    const result = await generateText({
      model: visionModel(),
      instructions: prompt.text,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse the attached photo and return the structured object." },
            { type: "file", mediaType: "image/jpeg", data: image.bytes },
          ],
        },
      ],
      output: Output.object({ schema: isReturn ? ReturnImageAnalysisSchema : ComplaintImageAnalysisSchema }),
      temperature: 0,
      maxRetries: 1,
      abortSignal: signal ? AbortSignal.any([budget, signal]) : budget,
    });
    logger.info("vision_done", { caseType: input.caseType, promptVersion: prompt.version, elapsedMs: Date.now() - started });
    return result.output;
  } catch (error) {
    throw toAppAiError(error, "vision");
  }
}
