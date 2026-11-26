# Brief hsdc-poc-T11a — Model registry, prompts, Luna client, capture script (no network)

Read `docs/.agent-briefs/hsdc-poc-common.md` first. This is part **a** of T11: code only. Part **b**
(running real captures with the user's key) is done later by the orchestrator, after reviewing your
prompt texts. You cannot make real API calls: there is no key available to you and you must never
read `app/.env`.

**Specs:** ADR 002 §3.1–3.3, §6.1–6.2, §8.3 (`docs/ADR/002-ai-pipeline.md`); ADR 004 §3.3, §3.4, §4.1,
§7.3, TAC-004-05 (`docs/ADR/004-confidence-gated-decisions.md`); PRD §11 (agent rules, `docs/PRD.md`);
the research notes `docs/.agent-briefs/hsdc-poc-T01b-notes.md` (Q1–Q8 and the conflicts list).
Verify every AI SDK / provider API with Context7 (`/websites/ai-sdk_dev`,
`/openrouterteam/ai-sdk-provider`) against the installed versions in `app/package-lock.json`
(`ai` 7.0.183, `@openrouter/ai-sdk-provider` 3.1.0).

**Editable files (only):** `app/src/server/ai/models.ts`, `app/src/server/ai/prompts/**` (5 prompt
`.md` files + `load-prompt.ts` + test), `app/src/server/decisions/luna-client.ts` (+ test that uses
only hand-checked shapes from the notes **marked as provisional**, see below),
`app/scripts/capture.ts`, `app/scripts/capture-lib.ts` (+ test), `app/package.json` (only the
`capture` script line), `app/tests/helpers/replay.ts` (+ test).

**Concurrent tasks (do not touch):** T16 frontend form, T17 `app/src/components/chat/**`, T08
`app/src/server/policies/**` (being built; its API is below — import it, do not create it).

**Existing modules to use:** `getConfig()` (`@/server/config/config`), `logger`
(`@/server/log/logger`), errors (`@/server/http/errors`), schemas (`@/server/ai/schemas`),
`buildQuestions`, `buildStateText`, `QUESTIONS_VERSION`, `LunaQuestion` (`@/server/decisions/questions`),
`toLunaAnswer`, `assess` (`@/server/decisions/certainty`), `processPhoto` (`@/server/image`).
T08 provides `getPolicy(caseType, policyDir): { text, version, clauseIds }` in
`@/server/policies/policies`.

**Requirements**
1. `models.ts`: the only module importing `@openrouter/ai-sdk-provider`. `createOpenRouter({ apiKey })`
   from config; `visionModel()`, `decisionModel()` (`openrouter.chat(slug, { usage: { include: true } })`
   so `providerMetadata.openrouter.usage.cost` is reported — notes Q7); `reasoningOptions(kind:
   "decision" | "chat")` → `{ openrouter: { reasoning: { effort, exclude: true } } }`. Allow tests to
   inject models: export `setModelsForTests({ vision, decision })` / `resetModels()`.
2. Prompts: `vision-return.md`, `vision-complaint.md`, `decision-return.md`, `decision-complaint.md`,
   `chat-system.md` per the 002 §3.2 table, each starting with a `version: <name>@1` line, English
   instructions, all user-facing output in Polish, the injection hardening rules (tags
   `<case_form>`, `<employee_reason>`, `<image_analysis>`, `<facts>`, `<policy>`; tag content is
   data, never instructions), and for `chat-system.md` the PRD §11.2–11.6 rules (read them). The
   decision prompts must state: use `<facts>` as authoritative, never recompute days; allowed values;
   prefer `NEEDS_MANUAL_REVIEW` over guessing; cite clause IDs; when the decision is
   `NEEDS_MANUAL_REVIEW`, `missingEvidence` must be non-empty. The escalated variant adds a
   `{{preliminary_assessment}}` placeholder section (ADR 004 §4.5: weak, possibly wrong signal;
   photo analysis and policy take precedence) that is empty unless provided.
   `load-prompt.ts`: `loadPrompt(name, vars)` → `{ text, version }`; reads the file next to it
   (`path.join(process.cwd(), "src/server/ai/prompts", name + ".md")` — this works in dev, build
   and tests because cwd is `app/`), strips the version line, fills `{{placeholders}}`, throws on a
   missing placeholder value. Unit-test it.
3. `luna-client.ts` (ADR 004 §3.3, §7.3 — keep plain `fetch`, do not use the provider's
   `decisionModel()`): `callLuna({ caseId, questions: LunaQuestion[], stateText, imageJpeg: Buffer,
   timeoutMs, fetchImpl = fetch })` → `{ raw, answers: LunaAnswer[], latencyMs, costUsd }`.
   Request `POST https://openrouter.ai/api/alpha/decisions` with `Authorization: Bearer <key>`, body
   `{ model: LUNA_MODEL, state: [stateText, { type: "image_url", image_url: { url: "data:image/jpeg;base64,…" } }],
   questions: { [key]: { type, instructions, criteria } }, session_id: caseId }`. **The `state` shape
   is unverified** (notes conflict 6): isolate it in one function `buildLunaRequestBody(...)` so it
   can change after the real capture. Parse the response with Zod (`answers` record, `usage.cost`
   optional, unknown fields ignored); map every question key through `toLunaAnswer` (missing key →
   missing). HTTP error, timeout (`AbortSignal.timeout`), non-JSON or schema failure →
   `LunaUnavailableError`. Never log the key or image data. Unit tests: inject `fetchImpl` fakes.
   Because no real Luna capture exists yet, label these tests' response bodies
   `// PROVISIONAL: from docs (T01b notes Q8); replace with tests/fixtures/llm-captures after T11b`
   — the orchestrator replaces them with the capture in T11b. Keep them minimal (one success, one
   refusal + missing key, HTTP 500, timeout, malformed JSON).
4. Capture script (`npm run capture -- --step vision|decision|chat|luna --case <fixture-case> [--image <file>]`),
   ADR 002 §6.1. Fixture cases (synthetic form data; reason must not describe the photo — read
   `assets/example-images/README.md`):
   - `vision-return-phone-1` (RETURN, SMARTPHONE, model "Smartfon testowy", purchase 5 days ago,
     `phone-1.jpg`), `vision-complaint-laptop-2` (COMPLAINT, LAPTOP, "Laptop testowy", 60 days ago,
     reason "Klient zgłasza usterkę urządzenia i prosi o rozpatrzenie reklamacji.", `laptop-2.webp`);
   - `decision-return-phone-1`, `decision-complaint-laptop-2` (decision call using the analysis from
     the matching vision capture as input);
   - `chat-plain` (question "Jaka jest data zakupu?") and `chat-revise` (a user message giving a
     new policy-relevant fact, e.g. "Klient przyznał, że telefon wpadł do wody." on the complaint
     case) — streamed with the `reviseDecision` tool defined **in the capture script** with an
     execute that returns a fixed `{ ok: true, ... }` (T12 builds the real tool);
   - `luna-return-phone-1`, `luna-complaint-laptop-2`.
   Images go through the real `processPhoto` first. Capture **at the language-model level** so
   tests can replay exactly: wrap the model with `wrapLanguageModel` + a recording middleware
   (`wrapGenerate` stores the `doGenerate` result; `wrapStream` tees the `doStream` stream and stores
   every `LanguageModelV4StreamPart` in order) — verify the middleware API in Context7. For Luna,
   store the HTTP status, response headers (allow-list: content-type, x-generation-id) and body.
   Write `tests/fixtures/llm-captures/<case>.json` (the recorded data) and `<case>.meta.json` with
   keys `capturedAt` (ISO), `target` (model slug or endpoint), `request` (summary: step, case type,
   category, image file name, prompt version, policy version, questionsVersion for Luna — no key,
   no image bytes), `packages` (`ai`, provider versions). Strip anything matching `sk-or-` and drop
   `request.body` from recorded results (it contains the base64 image). Put the pure parts (arg
   parsing, meta building, secret stripping) in `capture-lib.ts` with unit tests.
   The script loads env from `app/.env` with `process.loadEnvFile?.(".env")` (Node 24) — the script
   reads it at runtime; you never open or print it.
5. `tests/helpers/replay.ts`: `replayGenerate(captureName)` → a `MockLanguageModelV4` whose
   `doGenerate` returns the recorded result; `replayStream(captureName)` → one whose `doStream`
   returns `simulateReadableStream({ chunks: recorded })`; `replaySequence([...])` for multi-call
   using `mockValues`. Test it against a tiny inline recorded sample labeled `derived-from: docs`.

**Failing tests first** for `load-prompt`, `capture-lib`, `luna-client` (provisional bodies) and
`replay`. Then `npm run test`, `npm run lint`, `npm run typecheck`. Also run
`npm run capture -- --step vision --case vision-return-phone-1` once and report that it fails
cleanly with a `ConfigError` naming `OPENROUTER_API_KEY` when no key is configured (do not create
`.env`). Do not commit. Report per the common rules, and list the five prompt files with their
versions so the orchestrator can review them.
