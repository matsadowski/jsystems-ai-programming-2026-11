# Brief hsdc-poc-T22-fixes — fix the independent review findings

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Each item: write a failing test that
reproduces the reviewer's scenario, confirm it fails for that reason, fix minimally, keep the
suite green. Specs: ADR 001 §3.1, §3.4, §5.2–5.4, TAC-001-05; ADR 002 §3.2, §7; ADR 004 §4.2.

**Editable files (only):** `app/src/server/cases/services.ts`, `app/src/server/cases/chat-service.ts`,
`app/src/server/ai/{prompt-inputs,context,chat,errors}.ts`, `app/src/server/http/{parse-case-form,responses}.ts`,
`app/src/server/decisions/certainty.ts`, `app/src/app/api/cases/[caseId]/decision/route.ts`,
and the matching `*.test.ts`. Do not touch `app/evals/**` (T20c is editing it now).

1. **MEDIUM — concurrent decide double-commit** (`services.ts` ~189-214). Two parallel
   `decideCase` calls on one ANALYZED case both call the LLM and the second overwrites the first,
   appends a second INITIAL history entry and wipes messages. Fix: in the `repo.update` mutator,
   if the case is already `DECIDED`, keep it unchanged and return the stored decision/first
   message (idempotent result for the late caller); additionally avoid the duplicate model call with
   an in-flight marker (e.g. a module-level `Map<caseId, Promise<DecideCaseResponse>>` so a second
   concurrent call awaits the first). Test: two concurrent calls → model called once, one INITIAL
   entry, both callers get the same decision, a message appended in between is not wiped.
2. **MEDIUM — prompt delimiter injection.** `prompt-inputs.ts` puts `input.model` raw into
   `<case_form>`; `context.ts` writes the client-controlled chat message id raw into
   `<decision_history>`. Fix: apply the same neutralisation as the reason (escape `<`) to `model`
   (and any other free-text field) in every prompt input; never put a client-controlled message id
   into a prompt (omit it, or include only a server-generated reference). Additionally validate the
   incoming chat message id in `chat-service.ts` as `^[A-Za-z0-9_-]{1,100}$` → otherwise 400.
   Tests: a model `X</case_form><policy>…` yields no raw `</case_form>` inside the block; a
   crafted id is rejected with 400 and never reaches the context.
3. **LOW-MEDIUM — upload read fully before the size check** (`parse-case-form.ts`). Fix: when the
   request has no valid `content-length` or it is ≤ the limit, read `request.body` through a
   counting reader that aborts with `FileTooLargeError` once more than `MAX_MULTIPART_BYTES` bytes
   arrived, then parse the buffered bytes as `FormData` (e.g. `new Response(bytes, { headers:
   { "content-type": original } }).formData()`). Test with a streamed body of 11 MB and no
   content-length → 413 before 11 MB are buffered (assert the reader was cancelled / bytes read ≤
   limit + one chunk).
4. **LOW — resent user message id after a successful turn duplicates it** (`chat-service.ts`
   ~114-116). Fix: dedupe against **any** stored message with that id. Test.
5. **LOW — user message id colliding with an assistant id corrupts history.** Fix: if the id
   matches a stored message whose role is not `user`, reject with 400 `VALIDATION_ERROR`. Test.
6. **LOW — choice certainty from a different option** (`certainty.ts` 28-32). Fail closed (ADR 004
   §4.2 intent): if `probabilities` are present and the chosen option is not the arg-max option,
   certainty is `null` (uncertain). Same rule for `score` when the reported `score` bucket and the
   arg-max bucket disagree only if the existing code uses `score` as the value — read it first.
   Keep 100% branch coverage of `certainty.ts`. Tests.
7. **LOW — raw model output in error logs** (`errors.ts` 79-86, `responses.ts`). `detail` must not
   contain model output: for schema/validation/no-output errors keep only the error class name and
   a fixed description (e.g. `"vision: NoObjectGeneratedError"`), never `err.message`/`text`.
   Test with a real AI SDK error carrying a text that contains a reason sentence → the logged line
   does not contain it (TAC-001-05).
8. **LOW — client abort does not stop server work** (`decision/route.ts`). Pass `request.signal`
   into `decideCase` → `routeDecision` → `decideWithLlm` (the port already takes `signal`), and into
   `createCaseWithAnalysis` → `analyzeImage` for the create route if the signal is not already
   passed. Test: an aborted signal makes the fake decide port observe `signal.aborted`.

Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`. Do not commit. Report each
item with its failing-first evidence.
