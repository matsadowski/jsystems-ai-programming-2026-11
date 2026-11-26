# Brief hsdc-poc-T05 — Config, HTTP utilities, logger

Read `hsdc-poc-common.md` first.

**Goal.** `getConfig()` with fail-fast `ConfigError`; `parseJson`, `toErrorResponse`, request id;
a redacting logger. Specs: ADR 000 §7 + TAC-03; ADR 001 §3.1 items 2 and 6, §5.4 (logging part);
ADR 004 §9 (extra env vars); ADR 002 §6.3 `EVAL_MAX_COST_USD` (amendment A4, optional, default 5).

**Editable files:** `app/src/server/config/**`, `app/src/server/http/**` **except** `errors.ts` and
`parse-case-form.ts` (T14), `app/src/server/log/**`, plus their `*.test.ts`.

**Concurrent tasks (do not touch):** T07 `app/src/server/store/**`; T09
`app/src/server/ai/guardrails.ts`, `app/src/server/ai/render-first-message.ts`; T15
`app/src/app/{layout.tsx,globals.css}`, `app/src/components/AppHeader*`, `docs/design-guidelines.md`.

**Requirements**
- `src/server/config/config.ts`: `getConfig(env = process.env)` parses with Zod once (lazy cached
  singleton for `process.env`; passing an explicit env object bypasses the cache, for tests) and
  exposes typed values: `openrouterApiKey`, `visionModel`, `decisionModel`,
  `decisionReasoningEffort` (enum none|minimal|low|medium|high|xhigh|max, default medium),
  `chatReasoningEffort` (default low), `policyDir` (default `../docs/policies`, resolved against
  `process.cwd()` to an absolute path), `caseTtlMinutes` (120), `caseStoreMax` (200), `appTimezone`
  (`Europe/Warsaw`), `decisionMode` (`DECISION_MODES` from lib/shared, default `shadow`),
  `lunaModel` (`openai/gpt-6-luna-decisions`), `lunaConfidenceThreshold` (0.80, range 0.5–0.99),
  `lunaTimeoutMs` (5000), `evalMaxCostUsd` (5). Empty strings count as missing. On failure throw
  `ConfigError` (from `@/server/http/errors`) with `detail` naming every missing/invalid variable
  (names only, never values), and log that detail once. Export `resetConfigCache()` for tests.
- `src/server/log/logger.ts`: `logger.info|warn|error(event: string, fields?: Record<string, unknown>)`
  writing one JSON line through `console.info/warn/error` (so `captureLogs()` sees it). It redacts:
  any value matching `/sk-or-[\w-]+/` → `[REDACTED]`, any key named like
  `apiKey|authorization|key|token` → `[REDACTED]`, strings longer than 500 chars that look like
  base64 or `data:` URLs → `[REDACTED_BASE64 len=N]`. Never log reason text: callers pass lengths.
- `src/server/http/request-id.ts`: `newRequestId()` (UUID).
- `src/server/http/responses.ts`: `toErrorResponse(error, requestId)` → `Response` JSON
  `errorBody(...)` with status from the AppError and header `x-request-id`. Unknown errors →
  `500 INTERNAL_ERROR` with no stack/message leaked; log `error` with requestId, error name and
  message (redacted). `jsonResponse(body, status, requestId)` sets `x-request-id` too.
- `src/server/http/parse-json.ts`: `parseJson(request, schema)` → parsed value, or
  `ValidationError` with `toFieldErrors` (from lib/shared) on invalid JSON/shape.

**Failing tests first (Vitest, node env):**
1. Missing `OPENROUTER_API_KEY` (and separately `VISION_MODEL`, `DECISION_MODEL`) →
   `ConfigError`; `toErrorResponse` gives 503 body
   `{error:{code:"CONFIG_ERROR",message:"Usługa jest chwilowo niedostępna (błąd konfiguracji)."}}`;
   the captured log names the variable and never contains the key value.
2. Defaults applied; `LUNA_CONFIDENCE_THRESHOLD=0.3` → ConfigError; `DECISION_MODE=foo` → ConfigError.
3. Error-shape test for **every** code in `ERROR_DEFINITIONS`: status, body, `x-request-id` header.
4. Unknown `Error("secret stack")` → 500 `INTERNAL_ERROR`, body does not contain "secret stack".
5. Logger redaction: `sk-or-v1-abc123…` in a value or nested field never appears in captured logs;
   a 2 KB base64 string is replaced; `apiKey` key redacted.
6. `parseJson`: invalid JSON → ValidationError; schema failure → fieldErrors.

**Done when** the suite, lint and typecheck pass. Report per common rules.
