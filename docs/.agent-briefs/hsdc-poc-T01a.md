# Brief hsdc-poc-T01a — Tooling facts research

**Goal.** Produce a notes file of verified, version-matched facts the scaffold (T02) and test
infrastructure (T03) need. Research only: no code, no installs.

**Editable files:** `docs/.agent-briefs/hsdc-poc-T01a-notes.md` (create). Nothing else.
**Forbidden:** `course-materials/`, the nested `jsystems-ai-programming-2026-11/` folder, any `.env`.
**Concurrent task:** T01b writes `docs/.agent-briefs/hsdc-poc-T01b-notes.md` (do not touch).

**Lookup order.** Context7 MCP (`resolve-library-id` then `query-docs`, one concept per query) →
`<tool> --help` for CLIs → official vendor web pages last. Context7 IDs: Next.js `/vercel/next.js`
(try `v16.4.5`), Tailwind `/tailwindlabs/tailwindcss.com`, Vitest `/vitest-dev/vitest` (try `v5.0.3`),
Playwright `/microsoft/playwright`, axe: resolve `@axe-core/playwright`.
Run `npm view <pkg> version` to record current versions (next, react, tailwindcss,
@tailwindcss/postcss, vitest, @vitejs/plugin-react, jsdom, @testing-library/react,
@testing-library/jest-dom, @testing-library/user-event, @playwright/test, @axe-core/playwright,
eslint, eslint-config-next, tsx, server-only, sharp, zod, react-markdown, ai, @ai-sdk/react,
@openrouter/ai-sdk-provider, vite-tsconfig-paths).

**Questions to answer (each with source: Context7 ID or URL):**
1. `npx create-next-app@latest` flags for TS + Tailwind + ESLint + App Router + `src/` dir + npm +
   import alias `@/*`, non-interactive, no git, skip install (verify with `npx create-next-app@latest --help`).
2. C10: does Next 16 still have `next lint`? What is the documented lint command and the ESLint flat
   config shape created by create-next-app (eslint-config-next exports)? How to add
   `no-restricted-imports` (forbid `@/server/*` from `src/components/**`, `src/lib/**`) and
   `react/no-danger` in that flat config.
3. `next/font/local` usage with multiple weights from `.woff2`/`.ttf` files and a CSS variable.
4. Route handlers in Next 16: `request.formData()`, file uploads (`File`), Node runtime default,
   streaming `Response`, dynamic params signature for `app/api/cases/[caseId]/decision/route.ts`
   (are `params` a Promise in 16?), body size limits for route handlers (any default limit on
   multipart?).
5. Tailwind v4 with Next: `@import "tailwindcss"`, `@theme` tokens, postcss config file content.
6. Vitest 5 + Next guide: config file (`vitest.config.mts`), jsdom vs node environments per file
   (how to select environment per test file or via projects), setupFiles, path alias handling,
   coverage provider for branch coverage (v8), and how to run a subset.
7. Playwright: `webServer` as an array (two servers, ports 3000 and 3001 with different env),
   `reuseExistingServer`, `setInputFiles` with a file path.
8. `@axe-core/playwright`: `AxeBuilder` usage, filtering violations by impact.
9. `server-only` package: what it does under Vitest (does importing it throw in node env tests?) and
   the usual workaround (alias to an empty module in vitest config).

**Report format.** The notes file: one section per question, each fact with its source, flagged
conflicts or "UNVERIFIED" where no source confirmed it. Final reply to the orchestrator: a 10-line
summary of the key facts, conflicts, and anything unverified.
