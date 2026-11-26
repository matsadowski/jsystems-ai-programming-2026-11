# Brief hsdc-poc-T12a — AI pipeline pure parts (no model calls)

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Part **a** of T12: only logic that needs no
model and no capture. Part b (analyst, decision, chat with `MockLanguageModelV4` replaying real
captures) waits for the user's key.

**Specs:** ADR 002 §3.1 (`context.ts`, `errors.ts` rows), §4.5, §5.1, §7 items 1–2
(`docs/ADR/002-ai-pipeline.md`); ADR 004 §4.5–4.6 (`docs/ADR/004-confidence-gated-decisions.md`);
ADR 001 §5.4. Verify AI SDK v7 error classes against the installed `.d.ts` in
`app/node_modules/ai` (and Context7 `/websites/ai-sdk_dev`).

**Editable files (only):** `app/src/server/ai/context.ts`, `app/src/server/ai/errors.ts`,
`app/src/server/ai/revise-decision.ts`, `app/src/server/ai/prompt-inputs.ts`, and their `*.test.ts`;
`app/scripts/capture.ts` only to replace its local `caseFormText`/`factsText` with imports from
`prompt-inputs.ts` (no behaviour change).

**Concurrent task (do not touch):** T14a edits `app/src/server/cases/**`,
`app/src/server/http/parse-case-form.ts`, `app/src/app/api/**`.

**API**
- `prompt-inputs.ts`: `caseFormText(input)` (case type, category label, model, purchase date; no
  reason), `factsText(facts)`, `analysisText(analysis)` (JSON), `preliminaryAssessmentText(luna)`
  (each answer key, Polish answer label via `answerLabelPl`, certainty %, and "NIEPEWNE" marks for
  `uncertainKeys`). Pure.
- `context.ts`: `buildCaseContext(c: Case)` → delimited text with `<case_form>`, `<employee_reason>`,
  `<facts>`, then by `decisionPath`: `LLM`/`LLM_ESCALATED` → `<image_analysis>`; `FAST` → the Luna
  answers block and the note that visual details beyond them cannot be determined; `RULES` → the
  note "photo was not analysed because the window expired" (ADR 004 §4.6). Then
  `<current_decision>` (value, label, clauses) and `<decision_history>`.
- `errors.ts`: `toAppAiError(err, kind: "vision" | "decision" | "chat")` mapping: abort/timeout
  (`AbortError`, `TimeoutError` DOMException, AI SDK timeout errors) → `AiTimeoutError`;
  `NoObjectGeneratedError` / `NoOutputGeneratedError` / type-validation errors → `AiInvalidOutputError`;
  `APICallError` and anything else → `AiUnavailableError`; an existing `AppError` passes through.
  Tests construct the **real** AI SDK error classes (no mocks).
- `revise-decision.ts`: `applyRevision(c: Case, input: ReviseDecisionInput, ctx: { clauseIds, nowIso,
  messageId? })` → `{ result: ReviseDecisionResult; updated: Case | null }` per ADR 002 §7 item 2
  and §4.5: not allowed for case type → `NOT_ALLOWED_FOR_CASE_TYPE`; same value →
  `SAME_DECISION`; window expired and not REJECT → `WINDOW_EXPIRED`; unknown clause or wrong prefix
  → `UNKNOWN_CLAUSE`; success → new `Decision` (`source: "CHAT_REVISION"`, justification `[reason]`,
  keep nextSteps from the old decision unless a REJECT/ACCEPT flip makes them wrong — then a
  single Polish next step "Poinformuj klienta o zmianie decyzji (pkt X)."), `decisionHistory`
  entry `{ trigger: "CHAT_REVISION", at, messageId }`, labels from `decisionLabel`. Pure: never
  mutates the input case.

**Failing tests first** for all four modules (every error code of `applyRevision`, every branch of
`toAppAiError`, context per decision path, preliminary text). Then `npm run test`, lint, typecheck.
Do not commit. Report per the common rules.
