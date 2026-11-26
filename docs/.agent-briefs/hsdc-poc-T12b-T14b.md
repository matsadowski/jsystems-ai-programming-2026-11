# Brief hsdc-poc-T12b + T14b — AI services, wiring and chat route (after T11b captures)

Read `docs/.agent-briefs/hsdc-poc-common.md` first. **Prerequisite:** T11b done by the
orchestrator — real captures in `app/tests/fixtures/llm-captures/` (vision ×2, decision ×2,
chat-plain, chat-revise, luna ×2) with meta, and the Luna client tests switched from provisional
bodies to the luna captures.

**Specs:** ADR 002 §3, §5, §7, §10 (request-shape rows, corrective retry, invalid output → 502,
tool outcomes, stream error after tool), TAC-002-01–06; ADR 001 §5.3, §8 chat rows; ADR 004 §3.4,
§4.5–4.6, §5; PRD AC-14–AC-23, AC-26–AC-32.

**T12b files:** `app/src/server/ai/{analyst,decision,chat}.ts` + tests. Use `models.ts`,
`loadPrompt`, `prompt-inputs.ts`, `context.ts`, `errors.ts` (`toAppAiError`), `revise-decision.ts`
(`applyRevision`), `guardrails.ts`, `getPolicy`. Tests replay captures with
`tests/helpers/replay.ts` (`replayGenerate`, `replayStream`, `replaySequence`); derived variants
(e.g. a G2-violating decision) change only the decision fields and carry `derived-from` meta.
- `analyzeImage` (port `AnalyzeImage`): `generateText` + `Output.object` with the case-type schema,
  image as a `file` part (`mediaType: "image/jpeg"` — confirm against the vision capture's request
  summary), temperature 0, `maxRetries: 1`, 20 s budget; errors via `toAppAiError(err, "vision")`.
- `decideWithLlm` (port `DecideWithLlm`): decision prompt (+ `preliminaryAssessmentBlock` only when
  `preliminary` is given), reasoning options, `maxRetries: 0`, 35 s total budget across the call and
  one corrective retry listing the violations in English; `checkDecision`; fallback per 002 §5.3;
  both attempts failing to parse → `AiInvalidOutputError`.
- `chatStream(case, hooks)`: `streamText` with `instructions` = chat prompt, messages from
  `convertToModelMessages(case.messages + new user message)`, one tool `reviseDecision` whose
  execute calls `applyRevision` and commits through the repository immediately, `stopWhen:
  isStepCount(3)`, timeouts first chunk 20 s / total 60 s, reasoning excluded and reasoning parts
  dropped before streaming/persisting (TAC-002-05).

**T14b files:** `app/src/server/cases/deps.ts` (replace the not-wired ports with the real ones and
the Luna port built from `callLuna` + `buildQuestions` + `assess`; prompt versions per case type),
`app/src/server/cases/chat-service.ts` + test, `app/src/app/api/chat/route.ts`,
`app/scripts/smoke-api.ts`. Chat route per ADR 001 §5.3: JSON `{caseId, message}` validation,
404 / 409 `CASE_NOT_DECIDED` / 409 `CHAT_BUSY` before the stream, dedupe of a resent user message
id, `toUIMessageStream` with `messageMetadata` on `finish` → `{ decision: DecisionDTO }`, `onEnd`
persisting the assistant message and releasing the busy flag, error chunk text
`CHAT_STREAM_ERROR_MESSAGE`, nothing persisted for the assistant on error.

Then the orchestrator runs the real smoke (`npm run build && npm run start`, `npx tsx
scripts/smoke-api.ts`: 201 → 200 → streamed chat), re-records `create-in-window-*` API captures as
real LLM-path responses, and runs integration check G2.
