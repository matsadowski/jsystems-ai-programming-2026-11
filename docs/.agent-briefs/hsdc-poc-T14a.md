# Brief hsdc-poc-T14a — Case services, form parsing and API routes (no model calls)

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Part **a** of T14. The services receive their
AI and Luna steps as **injected ports**, so everything here is testable without a key; the
composition root that plugs in the real analyst/decider/Luna (T12b) and the chat route come in
part b. Tests use the RULES path (expired window: by design no model call) and typed fakes of our
own ports for the LLM path; they never fake OpenRouter responses.

**Specs:** ADR 001 §3.1, §5.1–5.2, §5.4, §8 route rows (`docs/ADR/001-backend-api.md`); ADR 004 §5;
ADR 000 TAC-03; PRD AC-12, AC-33–AC-36, AC-38. Next.js 16 route handlers: read
`app/node_modules/next/dist/docs/` (route handlers; `params` is a Promise) and T01a notes §4.

**Editable files (only):** `app/src/server/http/parse-case-form.ts` (+ test),
`app/src/server/cases/**` (+ tests), `app/src/app/api/cases/route.ts`,
`app/src/app/api/cases/[caseId]/decision/route.ts`.

**Concurrent task (do not touch):** T12a edits `app/src/server/ai/{context,errors,revise-decision,prompt-inputs}.ts`
and `app/scripts/capture.ts`.

**Existing modules:** `getConfig`, `logger`, `newRequestId`, `toErrorResponse`, `jsonResponse`,
`parseJson`, errors (`@/server/http/*`), `processPhoto` (`@/server/image`), `getCaseRepository`
(`@/server/store`), `getPolicy` (`@/server/policies/policies`), `routeAnalysis`/`routeDecision`
(`@/server/decisions/router` — read its header comment), `computeDecisionFacts`,
`renderFirstMessage`/`firstMessageUIMessage`, `decisionLabel`, `CATEGORY_LABELS`, `todayInZone`,
`makeCaseInputSchema`, `toFieldErrors`, DTO types in `@/lib/shared/api`, `answerLabelPl`/`QUESTION_LABELS_PL`
(`@/server/decisions/questions`).

**Requirements**
- `parseCaseForm(request)`: multipart only (else 400 `VALIDATION_ERROR`); declared `Content-Length`
  > 10.5 MB → `FileTooLargeError` before parsing; exactly one `photo` File (missing → fieldErrors
  `photo: "Dodaj zdjęcie sprzętu"`, two → 400); returns `{ fields: Record<string,string>, photo: File }`.
- `server/cases/services.ts` with a deps object
  `{ repo, clock, config: { appTimezone, decisionMode, lunaConfidenceThreshold, lunaTimeoutMs, policyDir },
     analyzeImage, assessWithLuna, decideWithLlm, newId }`:
  - `createCaseWithAnalysis(deps, fields, photo)` → validate with `makeCaseInputSchema(todayInZone(clock.now(), tz))`
    (`ValidationError` with `toFieldErrors`) → `processPhoto` → `computeDecisionFacts` →
    `routeAnalysis` → build and `repo.create` the `Case` (policy version from `getPolicy`, prompt
    versions as strings passed in deps, `shadow` per the router header) → return
    `CreateCaseResponse` (`analysis` DTO subset or null; `assessment` DTO with Polish labels and
    certainty % on FAST/LLM_ESCALATED, else null). On any error no case is created.
  - `decideCase(deps, caseId)` → 400 on malformed UUID; 404 unknown; idempotent when `DECIDED`
    (no dep calls); else `routeDecision` → store decision, history `INITIAL`, render first message
    (`messages = [firstMessage]`), status `DECIDED`, shadow comparison → `DecideCaseResponse`.
    On error the case stays `ANALYZED`.
- Routes: thin adapters; request id on every response (`x-request-id`); errors via
  `toErrorResponse`; `201` for create, `200` for decision. They obtain deps from
  `server/cases/deps.ts` → `getCaseDeps()`, which in this part builds repo/clock/config from
  `getConfig()` and, for the three AI ports, **throws `AiUnavailableError` with detail
  "AI pipeline not wired (T12b)"** — so the RULES path already works end-to-end in the real app
  and the LLM path fails cleanly until T12b. Config failure → 503 `CONFIG_ERROR` (TAC-03).
- Logs: request id, lengths and ids only; never reason text or bytes.

**Failing tests first:** `parseCaseForm` (non-multipart, oversize header, missing/two photos,
extra fields ignored); services with the real `InMemoryCaseRepository`, a fixed clock and real
example images: expired return (30 days, `phone-3.jpeg`) → 201 with `decisionPath: "RULES"`,
`analysis: null`, then decision → `REJECT` citing R1.3, first message contains "Uzasadnienie",
"Kolejne kroki" and the disclaimer — with port fakes asserting **zero** calls; validation errors →
`store.size()` unchanged; non-image `.jpg` → 415 and no port call (TAC-001-02); decision on
unknown id → 404, malformed id → 400; idempotency (second decide makes no calls); LLM path with
typed port fakes: decide failure (`AiTimeoutError`) → 504 and status stays `ANALYZED`, retry
succeeds. Route-level tests: call the exported `POST` handlers with real `Request` objects built
from `FormData` (real image bytes) and assert status, body shape `{ error: { code, message } }`
and `x-request-id` (TAC-001-03). For route tests that need deps, let `getCaseDeps` accept an
override via `setCaseDepsForTests(...)`.

Then `npm run test`, lint, typecheck, and `npm run build`. Do not commit. Report per the common
rules, with the public service signatures.
