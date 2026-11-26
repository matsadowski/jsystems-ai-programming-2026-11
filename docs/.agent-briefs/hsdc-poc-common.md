# hsdc-poc — rules for every worker (read together with your task brief)

Repository root: `/home/labuser/jsystems-ai-programming-2026-11`. The app is in `app/`; run every
npm/npx command from `app/`.

1. **Read order:** your brief → the PRD/ADR sections it links → `AGENTS.md` (root) →
   `app/AGENTS.md`. Never read `course-materials/` or the nested `jsystems-ai-programming-2026-11/`.
2. **Docs lookup:** Context7 MCP first (IDs in `docs/ADR/000-main-architecture.md` §2), then
   `<tool> --help`, web last. Research notes already exist: `docs/.agent-briefs/hsdc-poc-T01a-notes.md`
   (tooling) and `hsdc-poc-T01b-notes.md` (AI SDK / OpenRouter / Luna).
3. **TDD:** write the failing tests first, run them (`npx vitest run <path>`), record the failure
   reason; then implement minimally; keep the whole suite green (`npm run test`).
4. **Mocks:** unit/integration tests mock only external services (OpenRouter, Luna, our own API in
   component tests), only from real captures in `app/tests/fixtures/*-captures/`. A network guard
   makes every `fetch`/`http` call in tests fail ("network disabled in tests"). sharp is real.
5. **Contracts are fixed** (orchestrator-owned): `app/src/lib/shared/**`, `app/src/server/domain/**`,
   `app/src/server/ai/schemas.ts`, `app/src/server/http/errors.ts`. Import from them; do not edit
   them. If one is wrong or missing something, report it.
6. **Test helpers** (`app/tests/helpers/`): `captureLogs()`, `fixedClock(iso)`,
   `exampleImage(name)` / `exampleImagePath(name)`, `loadCapture(kind, name)`.
7. **Files and git:** edit only your brief's files. Never run `git add/commit/checkout/switch/stash/push`,
   `npm install <pkg>` (request dependencies in your report instead), `rm`, or `curl`. Never read
   or print `.env` files.
8. **Server modules** start with `import "server-only";` when they are runtime entry points of
   `src/server/**` (types-only files do not need it). Vitest aliases it to an empty module.
9. **Report** (final message): diff summary (files), the failing-first evidence (test names + failure
   reason), then separately: `npm run test` counts (files/tests passed/skipped/failed),
   `npm run lint`, `npm run typecheck`; contradictions found; dependency requests. If your Bash tool
   is denied, stop and report that immediately instead of guessing.
