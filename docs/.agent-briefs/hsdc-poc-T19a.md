# Brief hsdc-poc-T19a — E2E suite on the real stack: specs that need no model

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Part **a** of T19. The return/complaint LLM
specs, chat follow-up and the gated server spec (A2) need the user's key and come in part b.

**Specs:** ADR 003 §8 E2E rows and TAC-003-03/04 incl. amendment A1 (`docs/ADR/003-frontend.md`);
ADR 000 TAC-02, TAC-05, TAC-07; ADR 004 §10 (TAC-004-03); PRD AC-05, AC-08–AC-12, AC-20, AC-21,
AC-24–AC-26, AC-35, AC-37, AC-39, AC-40 (`docs/PRD.md`). Verify Playwright 1.65 and
`@axe-core/playwright` 4.14 APIs with Context7 (`/microsoft/playwright`) and the T01a notes §7–8.

**Editable files (only):** `app/e2e/**`, `app/playwright.config.ts`.

**Rules:** E2E mocks nothing — no `page.route`, no request interception. Real `next start` server,
real form, real images via `setInputFiles` from `../assets/example-images`. The config's
`webServer` must start the server with
`OPENROUTER_API_KEY=placeholder-not-a-key VISION_MODEL=anthropic/claude-sonnet-5.5 DECISION_MODEL=anthropic/claude-opus-5.5`
via its `env` option **only when `process.env.E2E_REAL_LLM !== "1"`** (part b will run with the
real `app/.env`); leave a comment explaining that the RULES specs never call a model. Do not create
or read `.env`. Dates are computed relative to "today" in Europe/Warsaw inside the spec.

**Specs to write (each fails first for a real reason: run it before finishing the spec's
assertions or against a deliberately wrong expectation, record the failure, then fix the
expectation to the spec — never weaken it):**
1. `expired-return.spec.ts`: Return, `phone-3.jpeg`, purchase 30 days ago → stages visible, chat
   with badge "Zwrot odrzucony", text cites R1.3, "Reguła terminu", first message contains
   "Uzasadnienie", "Kolejne kroki" and the exact disclaimer; screenshot each screen to
   `test-results/` (AC-20, AC-24, AC-40).
2. `expired-complaint.spec.ts`: Complaint, `laptop-2.webp`, purchase 25 months ago, neutral reason
   → "Reklamacja odrzucona", cites C1.3 (AC-21).
3. `validation.spec.ts`: submit disabled on empty form; future date → "Data zakupu nie może być z
   przyszłości"; complaint with 5-char reason shows the reason error after blur; and **no request
   to `/api/cases`** was made (observe with `page.on("request")`, not interception).
4. `photo.spec.ts`: `laptop-1.png` (JPEG bytes) accepted with thumbnail, name, Zmień, Usuń (AC-10).
5. `responsive.spec.ts`: 360×800 and 1280×800 on the form and on the chat screen (reach chat via
   the expired-return flow): `scrollWidth <= clientWidth` (AC-39).
6. `polish-text.spec.ts`: page text on both screens contains none of a list of English UI words
   ("Submit", "Loading", "Error", "Send", "Cancel", "Upload", "Next", "Back") (TAC-003-03).
7. `a11y.spec.ts`: `AxeBuilder` on the form and on the chat screen; fail on any violation with
   impact `critical` or `serious` (A1); attach the violation list on failure.
8. `new-case.spec.ts`: from chat, Nowe zgłoszenie → Anuluj keeps chat; → Rozpocznij nowe gives an
   empty form (AC-35).
9. `no-secrets.spec.ts` is **not** Playwright: instead add to your report the result of
   `grep -r "placeholder-not-a-key\|sk-or-" .next/static` after the build (TAC-05; expect no match).

Keep `smoke.spec.ts`. Make the specs independent (each starts from `/`). Run
`npm run build && npm run test:e2e` and report discovered/passed/skipped/failed counts. Also run
`grep -rn "page.route\|route(" e2e` and report that it is empty. If an a11y or UI defect is found
in a component, do **not** fix the component: report it with the axe rule id, target and impact
so the orchestrator can route it.

Do not commit. Report per the common rules.
