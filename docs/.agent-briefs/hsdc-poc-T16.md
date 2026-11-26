# Brief hsdc-poc-T16 — Form screen, reducer, processing and error states

Read `docs/.agent-briefs/hsdc-poc-common.md` first.

**Goal.** The case form UI and the client state machine. Specs: ADR 003 §3.1–3.3, §3.6, §4, §5,
§6.1, §8 rows 1–7 (`docs/ADR/003-frontend.md`); PRD AC-01–AC-12, AC-33, §9.2 (`docs/PRD.md`);
design tokens in `app/src/app/globals.css` (`@theme`: e.g. `bg-brand-primary`, `rounded-lg`,
`text-status-negative`; check the exact token names in that file).

**Editable files (only):** `app/src/components/case-app-reducer.ts` (+ test),
`app/src/components/form/**` (CaseForm, CaseTypeSelector, CategorySelect, PurchaseDateInput,
ReasonField, PhotoDropzone + tests), `app/src/components/ProcessingPanel.tsx` (+ test),
`app/src/components/ErrorBanner.tsx` (+ test), `app/src/components/api/client.ts`.

**Concurrent tasks (do not touch):** T06 `app/src/server/image/**`; T10
`app/src/server/decisions/*`; T17 `app/src/components/chat/**`, `app/src/components/ConfirmDialog*`.
Do not edit `page.tsx`, `AppHeader*`, `layout.tsx`, `globals.css` or anything in `lib/shared`
(contracts; report needs).

**Rules**
- Client code: never import `@/server/**` (ESLint enforces). Use `@/lib/shared` (enums, labels,
  limits, `makeCaseInputSchema`, `toFieldErrors`, `todayInZone`, DTO types).
- All visible text Polish (exact texts from PRD §9.2 and ADR 003). Native controls (ADR 003 §6.1).
- Reducer: pure, states `editing | analyzing | deciding | chat` with the transitions in §3.1
  (including `pendingCaseId` rules). Export the action types; `CaseApp` (T18) will drive API calls.
- `CaseForm` props: values/photo/errors from the parent plus callbacks, or self-contained — your
  choice, but expose a clean API for T18 (document it at the top of the file): it must receive
  `disabled` (processing), `bannerError?` with `onRetry`, and call `onSubmit(values, photoFile)` only
  when the whole form is valid. Errors show after blur or after a submit attempt (AC-11); after a
  failed submit focus moves to the first invalid field; `aria-describedby` on errors.
- `PurchaseDateInput` max = `todayInZone(new Date(), "Europe/Warsaw")`; accept an injectable `today`
  prop for tests.
- `PhotoDropzone`: client checks are hints (size ≤ 10 MB; type by MIME **or** extension, so
  `laptop-1.png` with JPEG bytes is accepted); thumbnail via `URL.createObjectURL`, revoke on remove
  and replace; shows name, size, **Zmień**, **Usuń**; keyboard-operable.
- `api/client.ts`: `createCase(values, file)` and `decideCase(caseId)` per §3.3 with client aborts
  30 s / 40 s, throwing `ApiError { status, code, message, fieldErrors }`. A client timeout maps to
  the same banner text as 504. **Do not write tests for `client.ts` in this task**: component tests
  that need API responses must use real captures (amendment A5), which T14 records later; T18 tests
  the client with them.

**Failing tests first** (`// @vitest-environment jsdom`, Testing Library + user-event; no network):
ADR 003 §8 rows 1–5 (reducer transitions incl. edit clearing `pendingCaseId`; submit disabled until
valid; reason requirement switch keeps text; future date with injected today `2026-11-25` →
"Data zakupu nie może być z przyszłości" and `max="2026-11-25"`; photo checks: an 11 MB `File` and a
`.gif` `File` are rejected with the AC-08/09 messages; a valid jpeg shows thumbnail + name +
Zmień/Usuń). For photo tests build `File` objects from the **real** example image bytes
(`exampleImage()`), and for the oversize case wrap a real image's bytes plus padding to exceed
10 MB. Rows 6–7 (server field errors, AI failure banner) are tested in T18 with captures; here test
only that `CaseForm` renders a given `bannerError` with **Spróbuj ponownie** calling `onRetry`, and
shows server-provided `fieldErrors` under the right field.
`jsdom` lacks `URL.createObjectURL`: stub it in the test file with `vi.fn`.

Run the component tests, `npm run test`, `npm run lint`, `npm run typecheck`. Do not commit.
Report per the common rules, including the public props of `CaseForm` for T18.
