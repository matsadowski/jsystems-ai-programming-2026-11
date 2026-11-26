# Brief hsdc-poc-T15 — Design foundation: tokens, font, layout, header

Read `docs/.agent-briefs/hsdc-poc-common.md` first.

**Goal.** Tailwind v4 `@theme` tokens from `assets/design-tokens.json`, Nunito Sans via
`next/font/local`, the root layout, and an `AppHeader` component. Specs: ADR 003 §3.5–3.6
(`docs/ADR/003-frontend.md`), `docs/design-guidelines.md`, PRD AC-37, AC-39 and §9.1 (header:
product name on the left; on the chat screen a "Nowe zgłoszenie" button on the right).

**Editable files (only):** `app/src/app/layout.tsx`, `app/src/app/globals.css`,
`app/src/components/AppHeader.tsx`, `app/src/components/AppHeader.test.tsx`,
`docs/design-guidelines.md` (append a new section "## App additions" at the end only),
`app/src/lib/shared/contrast.ts` + `contrast.test.ts` (a tiny pure WCAG contrast helper, allowed
as an exception to the "contracts are fixed" rule because it is new).

**Concurrent tasks (do not touch):** T05 `app/src/server/{config,http,log}/**`; T07
`app/src/server/store/**`; T09 `app/src/server/ai/*`. Do **not** touch `app/src/app/page.tsx` (T18
owns it) or anything else in `app/src/components/`.

**Requirements**
- `globals.css`: keep `@import "tailwindcss";` (Tailwind is wired through `@tailwindcss/turbopack`
  in `next.config.ts`; do not add postcss). Add `@theme` mapping every color in the token file
  (`--color-brand-primary`, `--color-tint-pink`, `--color-bg-light`, `--color-text-muted`,
  `--color-border-default`, …), the font family (`--font-sans: var(--font-nunito), sans-serif`),
  radii (`--radius-lg: 16px` for buttons/cards, `--radius-sm: 8px` for inputs, plus the others in
  the token file), font sizes and spacing from the token file where defined, and the status tokens
  from ADR 003 §3.5 (`--color-status-positive|negative|warning` and their `-bg` tints). Base styles:
  body background `#F7F7F8`, text `#000000`, `overflow-wrap: anywhere` on long text containers
  (ADR 003 §3.6), visible focus ring in brand color.
- `layout.tsx`: `next/font/local` with `../../public/fonts/NunitoSans-VariableFont.woff2` (normal,
  weight `200 1000`) and the italic file (style italic), `variable: "--font-nunito"`,
  `display: "swap"`; `<html lang="pl">`; Polish metadata title "Hardware Service Decision Copilot".
  Verify the `next/font/local` API with Context7 `/vercel/next.js` (v16.4.x) before writing.
- `AppHeader` (client-safe, no server imports): props `{ onNewCase?: () => void }`. Shows the text
  product name "Hardware Service Decision Copilot" on the left (as a link-less brand element, not
  an `h1`; the page owns the `h1`). When `onNewCase` is given, a "Nowe zgłoszenie" button on the
  right (outline style in brand color, ≥ 44 px touch target). The reference logo
  (`/logo.png`, third-party trademark) is rendered **only** when the env flag
  `process.env.NEXT_PUBLIC_DEMO_LOGO === "1"`… **no**: PRD AC-38 forbids `NEXT_PUBLIC_` variables.
  Instead accept a prop `showDemoLogo?: boolean` (default false); nobody passes true in this PoC.
- Contrast: implement `contrastRatio(hexA, hexB)` (WCAG 2.x relative luminance) in
  `app/src/lib/shared/contrast.ts`; tests assert each status text/tint pair, brand primary on white,
  white on brand primary, and `text.muted` on `background.light` are **≥ 4.5**. If a pair from
  ADR 003 fails, report it with the measured ratio and propose an adjusted hex (do not silently
  change the ADR).
- `docs/design-guidelines.md`: append "## App additions" with the status tokens table and the
  measured contrast ratios, and the note that the logo is not shown in the app build.

**Failing tests first:** `AppHeader.test.tsx` (`// @vitest-environment jsdom`): renders the product
name; no `img` by default; with `onNewCase` a button "Nowe zgłoszenie" calls it on click; without
`onNewCase` no button. `contrast.test.ts` as above.

After tests: `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build` (the font
must load at build time). Do not commit. Report per the common rules, including the contrast table.
