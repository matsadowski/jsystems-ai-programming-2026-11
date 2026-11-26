# Brief hsdc-poc-T18a — Real API captures (RULES path) and frontend wiring

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Part **a** of T18. The LLM path and the chat
route need the user's key (T12b/T14b); everything here uses the RULES path (expired window), which
already runs end to end on the real server without any model call, plus real error responses.

**Specs:** ADR 003 §3.1–3.3, §5, §8 rows 6–7 and 12, amendment A5, TAC-003-01–03
(`docs/ADR/003-frontend.md`); PRD AC-11, AC-12, AC-24, AC-33, AC-35, AC-36, §9 (`docs/PRD.md`).

**Editable files (only):** `app/scripts/capture-api.ts` (+ a test for its pure parts if any),
`app/tests/fixtures/api-captures/**`, `app/src/components/CaseApp.tsx` (+ `CaseApp.test.tsx`),
`app/src/app/page.tsx`, `app/tests/smoke/home-page.test.tsx` (update it to the new page),
`app/package.json` (only a new `"capture:api"` script line).

**Step 1 — real captures of our own API (A5).** Write `scripts/capture-api.ts` (run with
`npx tsx`, Node `fetch` + `FormData` with **real** example image bytes from `../assets/example-images`)
that calls a running server at `BASE_URL` (default `http://localhost:3000`) and saves each response
verbatim as `tests/fixtures/api-captures/<name>.json` = `{ status, headers: {content-type,
x-request-id}, body }` plus `<name>.meta.json` = `{ capturedAt, target: "<METHOD> <path>", request:
{ summary of fields and image file name }, server: "next start (local)", notes }`:
- `create-return-expired-rules` (RETURN, SMARTPHONE, purchase 30 days ago, `phone-3.jpeg`) → 201;
- `decide-return-expired-rules` (decision for that case) → 200; call it twice and save the second as
  `decide-return-expired-rules-repeat` (idempotency);
- `create-complaint-expired-rules` (COMPLAINT, LAPTOP, purchase 25 months ago, neutral reason
  "Klient zgłasza usterkę urządzenia i prosi o rozpatrzenie reklamacji.", `laptop-2.webp`) → 201,
  and its decision → 200;
- `create-validation-error` (missing model, future date) → 400 with fieldErrors;
- `create-unsupported-media` (a text file named `x.jpg`) → 415;
- `decide-unknown-case` (random UUID) → 404;
- `create-in-window-ai-unavailable` (RETURN 3 days ago, `phone-1.jpg`) → currently 502
  `AI_UNAVAILABLE` because the AI pipeline is not wired yet; label it in meta `notes`.
Start the server yourself for this: `npm run build` then, in the background,
`OPENROUTER_API_KEY=placeholder-not-a-key VISION_MODEL=anthropic/claude-sonnet-5.5 DECISION_MODEL=anthropic/claude-opus-5.5 npm run start -- --port 3000`
(the RULES path never uses the key; do not create or read `.env`). Stop the server when done
(`kill <pid>` of the process you started). The capture-meta test in `tests/infra` must stay green
(no secrets; `capturedAt`, `target`, `request` present).

**Step 2 — `CaseApp` + `page.tsx`.** `page.tsx` renders `<CaseApp />` with an `h1` per PRD §9.2
("Nowe zgłoszenie" on the form screen). `CaseApp` (client) owns `useReducer(caseAppReducer)`
(`app/src/components/case-app-reducer.ts`), calls `createCase`/`decideCase` from
`app/src/components/api/client.ts`, renders `AppHeader` (with `onNewCase` only in `chat`, which
opens `ConfirmDialog`; confirm → `RESET` and `URL.revokeObjectURL(photoPreviewUrl)`), `CaseForm`
(props documented at the top of `form/CaseForm.tsx`), `ProcessingPanel` (stage 1 while analyzing,
2 while deciding), `ErrorBanner` (via `CaseForm`'s `bannerError`/`onRetry`) and `ChatScreen`
(props documented in `chat/ChatScreen.tsx`). Retry rules per ADR 003 §3.1: with `pendingCaseId`
retry calls **only** `/decision`; after a 404 on decision, retry resubmits the whole form. Read the
existing component files before wiring; do not edit them — report needed changes instead.

**Failing tests first (`CaseApp.test.tsx`, jsdom):** stub `globalThis.fetch` with a function that
returns `new Response(JSON.stringify(capture.body), { status: capture.status, headers })` built
**only from the captures** above (`loadCapture("api", name)`); record request URLs.
1. Happy RULES flow: fill the form, submit → stage 1 → stage 2 → chat screen shows the badge
   "Zwrot odrzucony", the path label "Reguła terminu", "Zdjęcie nie było analizowane — termin minął"
   and the first message headings. (`useChat` must not send anything during this test; if it
   needs a transport stub, do not hit fetch for `/api/chat`.)
2. Decision 504 → banner with the AC-33 text, form values and photo kept; **Spróbuj ponownie**
   calls only `/decision`. The 504 body is a **derived** capture: copy
   `create-in-window-ai-unavailable` to `decide-ai-timeout-derived.json` changing only status to
   504 and code to `AI_TIMEOUT` (same Polish message), with meta `derived-from:
   create-in-window-ai-unavailable` (ADR 002 §6.2 / A5 rule).
3. 404 on decision retry → the next retry resubmits `/api/cases`.
4. 400 with fieldErrors → message under the field, no banner.
5. New case: confirm → empty form, object URL revoked.
Also: the chat request body test exists in T17; here assert that no request body sent by `CaseApp`
contains Polish labels instead of enum constants (ADR 003 §5).

Then `npm run test`, lint, typecheck, build. Do not commit. Report per the common rules, listing
the capture files created.
