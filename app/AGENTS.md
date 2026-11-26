<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# App rules (Hardware Service Decision Copilot)

Scoped rules for `app/`. The root `AGENTS.md` still applies. Specs: `../docs/PRD.md`,
`../docs/ADR/000…004`.

## Stack (pinned in `package-lock.json`)

Node 24 · Next.js 16.4 App Router (TypeScript strict) · React 19 · Tailwind CSS 4 via
`@tailwindcss/turbopack` · Zod 4 · sharp 0.35 · AI SDK 7 (`ai`, `@ai-sdk/react`) ·
`@openrouter/ai-sdk-provider` 3.1 · react-markdown 10 · Vitest 5 + Testing Library · Playwright 1.65
+ `@axe-core/playwright`.

## Commands (run from `app/`)

| Purpose | Command |
|---|---|
| Dev server | `npm run dev` (port 3000) |
| Lint (Next 16 has no `next lint`) | `npm run lint` (`eslint .`) |
| Type check | `npm run typecheck` |
| Unit + integration + component tests | `npm run test` (`vitest run`); one file: `npx vitest run <path>` |
| Coverage | `npm run test:coverage` |
| Production build / start | `npm run build` then `npm run start` |
| E2E (real stack, needs a build) | `npm run test:e2e` |
| Real LLM captures / eval | `npm run capture` / `npm run eval -- [--runs N] [--only targeted\|matrix\|<case-id>]` (need `app/.env`; eval cost is capped by `EVAL_MAX_COST_USD`, reports in `evals/reports/`) |

## Code rules

- `src/server/**` is server-only. `src/components/**` and `src/lib/**` must not import it (ESLint
  `no-restricted-imports`). Server entry modules import `server-only`.
- No `dangerouslySetInnerHTML` (ESLint `react/no-danger`). Model Markdown goes through react-markdown
  without raw HTML.
- Route handlers stay thin: parse → service in `src/server/cases` → serialize. Dynamic `params` is a
  Promise and must be awaited.
- Every UI string is Polish. Enum constants are English uppercase.
- Dates: use the helpers in `src/lib/shared` with `APP_TIMEZONE`; never `new Date()` for "today" in
  domain code (inject the clock).

## Tests

- Component tests start with `// @vitest-environment jsdom`; the default environment is `node`.
- Unit/integration tests mock only external services (OpenRouter, Luna, our own API in component
  tests), and only from real captures in `tests/fixtures/llm-captures/` or
  `tests/fixtures/api-captures/` with a `.meta.json`. Example images are read from
  `../assets/example-images/` (never copied).
- E2E (`e2e/`) mocks nothing: no `page.route`.
- Never read or print `.env`.
