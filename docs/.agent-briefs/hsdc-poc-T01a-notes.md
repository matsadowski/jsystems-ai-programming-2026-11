# hsdc-poc-T01a — Tooling facts notes

Scope: research only. No installs, no code. Sources are Context7 IDs or official URLs.

**Environment limitation:** the Bash tool was denied by the auto-mode classifier during this run. As a result, `npm view <pkg> version` and `npx create-next-app@latest --help` were NOT run. Every package version below is UNVERIFIED, and CLI flags come from the Next.js v16.4.5 docs in Context7, not from `--help`. Re-run the npm and `--help` checks before T02.

Context7 IDs used: `/vercel/next.js/v16.4.5`, `/tailwindlabs/tailwindcss.com`, `/vitest-dev/vitest/v5.0.3`, `/microsoft/playwright`, `/websites/playwright_dev`, `/dequelabs/axe-core-npm`.

---

## 1. create-next-app flags

Source: Context7 `/vercel/next.js/v16.4.5`, `docs/01-app/03-api-reference/06-cli/create-next-app.mdx`. Verified against docs, not `--help`.

- Relevant flags: `--ts`, `--tailwind`, `--eslint`, `--app`, `--src-dir`, `--import-alias "@/*"`, `--use-npm`, `--skip-install`, `--disable-git`, `--yes`.
- Non-interactive run: `npx create-next-app@latest <name> --yes` gives TS, Tailwind, ESLint, App Router, Turbopack, alias `@/*`. `--yes` uses saved preferences or defaults. `--src-dir` is NOT in the `--yes` defaults, so pass it explicitly.
- Suggested T02 invocation (to verify): `npx create-next-app@latest <name> --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --skip-install --disable-git --yes`.
- Git: the flag is `--disable-git`. No `--no-git` flag is documented.
- Defaults that may matter: `--agents-md` (default on, adds an AGENTS.md; check for a conflict with this repo's AGENTS.md), `--agent-feedback` (default on, prompts or prepares feedback; consider `--no-agent-feedback`), `--cache-components` (default on for App Router, which affects route segment config), `--turbopack` (default on).
- Also present: `--no-linter` and `--biome`.
- Conflict to resolve: `--yes` says it uses "previous preferences or defaults". Passing every flag explicitly avoids stored preferences.
- `--skip-install` is documented.

## 2. Lint (C10)

- **`next lint` is removed in Next.js 16.** Source: `docs/01-app/02-guides/upgrading/version-16.mdx` ("Removals") and `docs/01-app/03-api-reference/05-config/03-eslint.mdx`. `next build` no longer runs lint. The `eslint` key in next.config is also removed.
- Documented lint command: run ESLint CLI directly, e.g. `eslint .` (the codemod sets `package.json` scripts to `eslint .`). UNVERIFIED for create-next-app's generated script name.
- Flat config created by Next docs (`eslint.config.mjs`), Source: `03-eslint.mdx`:

```js
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
```

- **CONFLICT:** the codemod (`upgrading/codemods.mdx`) generates a FlatCompat config using `compat.extends('next/core-web-vitals', 'next/typescript')`. The current docs use `eslint-config-next/core-web-vitals` with `defineConfig`. Use the current docs form. Whether `eslint-config-next/typescript` is an export is UNVERIFIED.
- `no-restricted-imports` to forbid `@/server/*` from `src/components/**` and `src/lib/**`: UNVERIFIED. Context7 returned no ESLint core-rule docs. Expected shape is a flat-config object with `files: ['src/components/**', 'src/lib/**']` and `rules: {'no-restricted-imports': ['error', {patterns: [{group: ['@/server/*'], message: '...'}]}]}`. Verify against ESLint docs (eslint.org) before T02.
- `react/no-danger`: UNVERIFIED. Expected to come from `eslint-plugin-react`. Check whether `eslint-config-next` already loads the react plugin (it does, but the exact rule set is unconfirmed). Verify before T02.

## 3. next/font/local (multiple weights + CSS variable)

Source: `docs/01-app/03-api-reference/02-components/font.mdx`. VERIFIED.

```ts
import localFont from 'next/font/local'

const brand = localFont({
  src: [
    { path: './Brand-Regular.woff2', weight: '400', style: 'normal' },
    { path: './Brand-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-brand',
  display: 'swap',
})
// apply brand.variable on <html> or <body>, then use var(--font-brand) in CSS
```

- Paths are relative to the file that calls `localFont`.
- `src` is required for `next/font/local`. Supports `.woff2`, `.ttf` and others.
- `weight` on each entry is required for non-variable fonts. For a variable font, use a range string such as `'100 900'`.
- `variable` sets the CSS custom property name.

## 4. Route handlers (Next 16)

Source: `docs/01-app/03-api-reference/03-file-conventions/route.mdx`, `02-route-segment-config/runtime.mdx`, `05-config/01-next-config-js/proxyClientMaxBodySize.mdx`, `serverActions.mdx`.

- **`params` is a Promise.** VERIFIED. Signature:

```ts
export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
}
```

- `request.formData()`: VERIFIED. `const formData = await request.formData(); const file = formData.get('file')`. The value is a `File` for file parts (standard Web API, not shown in the Next docs). Type narrowing (`instanceof File`) is standard Web API, not Next-specific, so it is UNVERIFIED against Next docs.
- Runtime: default is `'nodejs'`. VERIFIED. `'edge'` is deprecated. With Cache Components enabled, do NOT export `runtime`.
- Streaming: `return new Response(readableStream, { headers })` with `ReadableStream` and `TextEncoder`. VERIFIED (`docs/01-app/02-guides/streaming.mdx`). `FileHandle.readableWebStream()` also documented.
- **Body size limits:**
  - `serverActions.bodySizeLimit` default is 1MB. It applies to Server Actions, not route handlers. Source: `serverActions.mdx`.
  - `experimental.proxyClientMaxBodySize` default is 10MB. It applies only when a `proxy` file is used, and an oversize body is silently truncated with a warning, not rejected. Source: `proxyClientMaxBodySize.mdx`.
  - **Route handler default multipart limit: NOT FOUND in the docs.** UNVERIFIED. Treat this as a risk. Test with a real upload before relying on any limit. Do not assume a 1MB or 10MB limit.
- Pages Router `bodyParser.sizeLimit` (default 1mb) is documented in `07-api-routes.mdx`, but it does not apply to App Router route handlers.

## 5. Tailwind v4 with Next

Source: Context7 `/tailwindlabs/tailwindcss.com`.

- PostCSS config (VERIFIED):

```js
// postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- Remove `postcss-import` and `autoprefixer`. v4 handles both. Source: `src/docs/upgrade-guide.mdx`.
- CSS entry (VERIFIED): `@import "tailwindcss";` followed by `@theme { --color-brand-500: oklch(...); --font-display: "..."; }`. Source: `src/blog/tailwindcss-v4/index.mdx`.
- No `tailwind.config.js` is needed for tokens. Tokens go in `@theme`.
- Package versions: UNVERIFIED (`tailwindcss` and `@tailwindcss/postcss` via `npm view`, not run).

## 6. Vitest 5

Source: Context7 `/vitest-dev/vitest/v5.0.3`.

- Config file: `vitest.config.mts` with `defineConfig` from `vitest/config`. VERIFIED (`docs/config/index.md`).
- Environment: `test.environment: 'jsdom' | 'happy-dom' | 'node'`. VERIFIED (`docs/guide/features.md`). Default is node.
- **Per-file environment:** docblock `/** @vitest-environment jsdom */` or line comment `// @vitest-environment jsdom` at the top of the file. VERIFIED (`docs/config/environment.md`, `docs/guide/environment.md`).
- Setup files: `test.setupFiles: ['./test/setup.ts']`. VERIFIED.
- Path aliases: `resolve.alias` is a top-level Vite option, not under `test`. VERIFIED (`docs/config/index.md`). In Vitest, aliases such as `@/` need `new URL('./src/', import.meta.url).pathname`. VERIFIED (`docs/guide/common-errors.md`). The `vite-tsconfig-paths` plugin is listed in the brief but was NOT confirmed by Context7 as the path-alias method, so it is UNVERIFIED.
- Coverage provider `v8`: VERIFIED (`docs/guide/coverage.md`). Set `test.coverage.provider: 'v8'`. Branch thresholds: `coverage.thresholds.branches`, with optional per-glob objects and `perFile`. VERIFIED (`docs/config/coverage.md`). Use `coverage.include: ['src/**/*.{ts,tsx}']` so untested files count.
- Run a subset: `vitest <path-substring>` (file path filter, not regex or glob). `vitest <file> -t "<name>"` for test name. VERIFIED (`docs/guide/cli.md`, `docs/guide/filtering.md`).
- Multi-environment config: `--project <name>` is a CLI option for projects. Exact `test.projects` config shape: UNVERIFIED. Context7 only returned the CLI option. Verify in Vitest docs before T03 if two environments are needed in one run.

## 7. Playwright webServer as array

Source: Context7 `/microsoft/playwright` and `/websites/playwright_dev`. VERIFIED.

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: [
    {
      command: 'npm run start:app',          // placeholder command
      url: 'http://localhost:3000',
      name: 'App',
      reuseExistingServer: !process.env.CI,
      env: { /* app env */ },
      timeout: 120_000,
    },
    {
      command: 'npm run start:app-b',        // placeholder command
      url: 'http://localhost:3001',
      name: 'Second',
      reuseExistingServer: !process.env.CI,
      env: { /* different env */ },
      timeout: 120_000,
    },
  ],
  use: { baseURL: 'http://localhost:3000' },
});
```

- `webServer` may be an array. VERIFIED.
- If `webServer` is an array, `use.baseURL` must be set explicitly. VERIFIED (`class-testconfig.md`).
- `reuseExistingServer: !process.env.CI` is the documented pattern. VERIFIED.
- `env` per server is supported. VERIFIED. Defaults to `process.env` with `PLAYWRIGHT_TEST=1`.
- Use `url` rather than `port`. `port` is deprecated in the docs, though the `TestConfigWebServer` type still lists it. VERIFIED.
- Top-level servers start before `globalSetup`. VERIFIED.
- Run a single file: `npx playwright test <path-regex>`. Arguments are regex matched against file paths. `-g` filters by test title. `--project` filters projects. VERIFIED (`playwright.dev/docs/test-cli`).

## 8. setInputFiles with a file path

Source: `/microsoft/playwright` `docs/src/input.md` and `class-locator.md`. VERIFIED.

```ts
await page.getByLabel('Upload file').setInputFiles(path.join(__dirname, 'fixtures/sample.png'));
```

- Accepts a path string, an array of paths, a directory path, `[]` to clear, or `{name, mimeType, buffer}`.
- Use `path.join` with an absolute path in the test file. The fixture path must exist.
- For E2E tests per the project rule (no mocks), use a real synthetic fixture file on disk.

## 9. @axe-core/playwright

Source: Context7 `/dequelabs/axe-core-npm` (`packages/playwright/README.md`). VERIFIED.

- Note: the Context7 ID resolved to `/dequelabs/axe-core-npm`, not a package named `@axe-core/playwright` itself. The brief asked for resolve of `@axe-core/playwright`. This is the same monorepo.

```ts
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa'])
  .analyze();

const serious = results.violations.filter(
  (v) => v.impact === 'serious' || v.impact === 'critical'
);
```

- `new AxeBuilder({ page })`: VERIFIED.
- `.withTags(string | string[])`: VERIFIED.
- `.analyze()` returns `Promise<axe.Results>`. Impact is on each violation (`violation.impact`). Impact filtering in code is standard JS. The exact `impact` values (`minor | moderate | serious | critical`) come from axe-core and are UNVERIFIED in this run.
- Do not call `withTags` after `options` or `withRules` expecting to combine them. Later calls override earlier ones. VERIFIED.

## 10. server-only under Vitest

- **Context7: NOT FOUND.** `resolve-library-id` for `server-only` returned unrelated libraries. Mark UNVERIFIED.
- Expected behavior (from memory, UNVERIFIED): importing `server-only` outside the `react-server` condition throws at import time. Under Vitest's node environment it therefore throws when a test imports a server module.
- Expected workaround (UNVERIFIED): alias `server-only` to an empty module in `vitest.config.mts` (`resolve.alias`) or use `vi.mock('server-only', () => ({}))` in the test file.
- Verify from the package README on npm or the Next.js docs before T03.

---

## Conflicts and open items

1. Package versions (all 20 packages in the brief): UNVERIFIED. `npm view` was denied. Re-run before T02.
2. `create-next-app --help`: not run. Flag names are from the v16.4.5 docs.
3. ESLint config: codemod (`next/core-web-vitals`, FlatCompat) vs current docs (`eslint-config-next/core-web-vitals`, `defineConfig`). Use the current docs.
4. `no-restricted-imports` and `react/no-danger` flat-config shapes: UNVERIFIED.
5. Route handler multipart body limit: no documented default for App Router route handlers. UNVERIFIED. Test with a real upload.
6. Vitest path alias with `vite-tsconfig-paths`: UNVERIFIED.
7. Vitest `test.projects` config shape: UNVERIFIED (CLI `--project` verified).
8. `server-only` under Vitest: UNVERIFIED (not in Context7).
9. Impact level strings for axe: UNVERIFIED.
