# Brief hsdc-poc-T17 — Chat screen

Read `docs/.agent-briefs/hsdc-poc-common.md` first.

**Goal.** The chat screen components and the `useChat` transport. Specs: ADR 003 §3.2 (chat rows),
§3.4, §3.6, §6.2, §6.3, §8 rows 8–12 (`docs/ADR/003-frontend.md`); ADR 002 §7 (notice text,
`docs/ADR/002-ai-pipeline.md`); PRD AC-24–AC-32, AC-35, AC-44 and §9.3 (`docs/PRD.md`). Verify AI SDK
v7 / `@ai-sdk/react` 4 APIs with Context7 `/websites/ai-sdk_dev` and the notes in
`docs/.agent-briefs/hsdc-poc-T01b-notes.md` §5–6. Use design tokens from `app/src/app/globals.css`.

**Editable files (only):** `app/src/components/chat/**` (ChatScreen, CaseSummaryPanel,
DecisionBadge, DecisionPathLabel, MessageList, MessageBubble, Markdown, DecisionChangeNotice,
ChatInput, chat-transport.ts, + tests) and `app/src/components/ConfirmDialog.tsx` (+ test).

**Concurrent tasks (do not touch):** T16 `app/src/components/{case-app-reducer.ts,form/**,ProcessingPanel*,ErrorBanner*,api/**}`;
T06 `app/src/server/image/**`; T10 `app/src/server/decisions/*`; T08 `app/src/server/policies/**`.
Do not edit `page.tsx`, `AppHeader*`, `layout.tsx`, `globals.css`, `lib/shared/**`.

**Data contracts** (from `@/lib/shared`): `CaseSummary`, `AnalysisDTO | null`, `AssessmentDTO | null`,
`DecisionDTO` (has `decisionPath`), `TextUIMessage`, `ChatMessageMetadata`, `ReviseDecisionResult`,
`DECISION_PATH_LABELS`, `CHAT_MESSAGE_MAX_LENGTH`. Never import `@/server/**`.

**Requirements**
- `ChatScreen` props: `{ caseId, caseSummary, analysis, assessment, decision, firstMessage,
  photoPreviewUrl, onNewCase }`. It owns `useChat` (`id: caseId`, `messages: [firstMessage]`,
  `transport: createChatTransport(caseId)`), keeps the current `DecisionDTO` in state, updates it
  from finish metadata (`message.metadata.decision`) and immediately from a `tool-reviseDecision`
  part in state `output-available` with `ok: true` (ADR 003 §6.3). Layout: two columns ≥ 1024 px
  (summary 320 px left), stacked below (ADR 003 §3.6). Conversation region `role="log"`
  `aria-live="polite"`.
- `chat-transport.ts`: `createChatTransport(caseId)` → `DefaultChatTransport` with
  `api: "/api/chat"` and `prepareSendMessagesRequest` returning `{ body: { caseId, message: last } }`.
  Export the pure `buildChatRequestBody(caseId, messages)` too and unit-test it (TAC-003-02: exactly
  the keys `caseId` and `message`).
- `CaseSummaryPanel`: fields and the path-dependent assessment section exactly as ADR 003 §3.2
  (`LLM`/`LLM_ESCALATED`: "Opis zdjęcia (AI)" + `analysis.summary`; `FAST`: "Ocena automatyczna",
  one row per `assessment.items` like "Ślady użytkowania: brak — 93%"; `LLM_ESCALATED` also lists
  uncertain items; `RULES`: "Zdjęcie nie było analizowane — termin minął"). "{n} dni temu" from
  `decision.daysSincePurchase`. Thumbnail click opens an enlarged view (native `<dialog>`).
- `DecisionBadge`: label + icon + tone classes (`status-positive|negative|warning`); meaning not by
  color alone. `DecisionPathLabel`: `DECISION_PATH_LABELS[decision.decisionPath]`.
- `Markdown`: react-markdown with raw HTML disabled (no `rehype-raw`), `allowedElements` limited to
  headings, p, strong, em, ul, ol, li, code; links rendered as plain text (`unwrapDisallowed`).
- `MessageBubble`: agent left, user right; text → `Markdown`; `tool-reviseDecision` output with
  `ok: true` → `DecisionChangeNotice` ("Decyzja zmieniona: {fromLabel} → {toLabel}", the reason
  from the tool input, and the disclaimer from ADR 002 §7); `ok: false` → nothing. Typing indicator
  while `status` is `submitted`/`streaming` and the last assistant message has no text yet (AC-28).
- `ChatInput`: auto-grow textarea up to 6 lines; Enter sends, Shift+Enter newline; send disabled
  for empty/whitespace, while streaming, and over 2000 chars with a visible message; counter shown
  from 1800 chars (AC-27, AC-28, AC-32).
- Errors: on `useChat` error keep the failed user message with an inline error and **Ponów**
  (calls `regenerate()` / resends the same message). If the error body code is `CASE_NOT_FOUND`,
  show the server message and a **Nowe zgłoszenie** action instead (ADR 003 §3.4).
- `ConfirmDialog`: native `<dialog>`, text "Bieżąca rozmowa zostanie utracona.", buttons
  **Anuluj** / **Rozpocznij nowe**, focus trapped, Escape = Anuluj.
- All text Polish.

**Failing tests first** (`// @vitest-environment jsdom`; no network; test presentational components
with props, not a live `useChat`): ADR 003 §8 rows — first message render (headings/lists/bold
rendered, no literal `#`/`**`, `<script>` shown as text); chat input keys (Enter / Shift+Enter /
whitespace / 2001 chars); streaming state (typing indicator, send disabled); decision change notice
(`ok:true` shows notice and badge text, `ok:false` nothing); new case confirm (Anuluj keeps,
Rozpocznij nowe calls `onNewCase`); `buildChatRequestBody` keys; summary panel per decision path.
jsdom lacks `HTMLDialogElement.showModal`: polyfill it in the test file.

Run tests, `npm run test`, `npm run lint`, `npm run typecheck`. Do not commit. Report per the
common rules, including `ChatScreen` props for T18.
