# Brief hsdc-poc-T21-fixes — defects found in manual QA + Luna captures in tests

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Fix each item test-first.

**Editable files (only):** `app/src/server/http/responses.ts` (+ test),
`app/src/server/cases/services.ts` (+ test), `app/src/server/decisions/luna-client.test.ts`,
`app/src/server/decisions/router.test.ts`, `app/src/server/cases/deps.test.ts`.

1. **5xx AppErrors are not logged (ADR 001 §5.4: "a request id, which is logged with every
   error").** QA: a 502 `AI_UNAVAILABLE` from an invalid `VISION_MODEL` left no log line.
   `toErrorResponse` must log every AppError with status ≥ 500 at `error` level (`event:
   "request_failed"`, requestId, code, status, `detail`, cause name) and 4xx at `info`
   (`request_rejected`, requestId, code, status). Never log the message body of the request or the
   key (the logger already redacts). Test with `captureLogs()`.
2. **Shadow result is stored but not logged (ADR 004 §3.1: "stored and logged").** In
   `decideCase`, when `c.shadow` is set, add `shadowFast` and `agreesWithLlm` to the
   `case_decided` log line; in `createCaseWithAnalysis` log `luna_shadow` with the shadow fast
   result, `uncertainKeys` and Luna `latencyMs`/`costUsd` when a Luna assessment exists. Test it.
3. **Replace the provisional Luna test bodies** in `luna-client.test.ts` with the real captures
   `luna-return-phone-1` and `luna-complaint-laptop-2` (`loadCapture("llm", name)` → `body`);
   derived variants (refusal for one key, missing key, malformed JSON) must be built from a real
   capture body and commented `derived-from: <capture>`. Remove the PROVISIONAL labels.
4. **Router integration with real Luna answers** (`router.test.ts` or `deps.test.ts`): build the
   `LunaAssessment` through `createAssessWithLuna` with `call` returning the parsed real capture
   (via `callLuna` with a `fetchImpl` that returns the capture's status and body) and assert:
   gated + return phone-1 (all certain, `signs_of_use` 3) → `FAST` `REJECT` citing R2.1/R2.3 with
   zero vision/LLM calls; gated + complaint laptop-2 (`defect_visibility` confidence 0.37) →
   `LLM_ESCALATED` with `defect_visibility` in `uncertainKeys`; shadow → path `LLM` with the fast
   result stored.

Then `npm run test`, lint, typecheck. Do not commit. Report per the common rules.
