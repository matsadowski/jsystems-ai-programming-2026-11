# Brief hsdc-poc-T19b — E2E on the real stack with the real model

Read `docs/.agent-briefs/hsdc-poc-common.md` first. T19a specs exist in `app/e2e/` (read them and
`app/e2e/helpers.ts`). Now add the specs that need the real model. Decisions D8/D9 apply:
models are `openai/gpt-6-luna`, `DECISION_MODE=llm_only`, the gated server spec (A2) is dropped
(Luna provider outage) — do not write it.

**Editable files (only):** `app/e2e/**`, `app/playwright.config.ts`.

**How it runs:** `E2E_REAL_LLM=1 npm run test:e2e` — the config then passes no env override, so
`next start` reads the real `app/.env` (you never open or print it). Build first. Specs needing
the model must `test.skip(process.env.E2E_REAL_LLM !== "1", "needs the real model")` so the
default run stays green without a key. Timeouts: up to 90 s per LLM step. No `page.route`.

**Specs (ADR 003 §8 E2E rows; PRD AC-13–AC-19, AC-22–AC-32):**
1. `llm-return.spec.ts`: Return, `phone-1.jpg`, 3 days ago → stages "Analizuję zdjęcie…" then
   "Przygotowuję decyzję…" visible in order; chat screen with a badge whose text is one of the
   three return labels; path label "Pełna analiza AI"; "Opis zdjęcia (AI)" section non-empty;
   first message contains "Uzasadnienie", "Kolejne kroki", a clause id matching `/R\d/` and the
   exact disclaimer. Assert invariants only — never a specific decision (example-images README).
   Then a follow-up "Jaka jest data zakupu?" → an agent reply appears that contains the purchase
   date in some Polish form or the day count; typing indicator was visible and the send button
   disabled while streaming (AC-27, AC-28, AC-29).
2. `llm-complaint.spec.ts`: Complaint, `laptop-2.webp`, 60 days ago, neutral reason → badge text
   from the complaint label set; clause id `/C\d/`. Then the message "Klient przyznał, że laptop
   został zalany kawą tydzień przed wystąpieniem usterki." → expect "Decyzja zmieniona:" notice
   and the badge "Reklamacja odrzucona" (if the current decision already was that, assert the
   notice is absent and the badge unchanged instead — the spec must handle both honestly).
3. `chat-limits.spec.ts`: on a chat screen reached via the RULES flow (no model for the first
   message) type 2001 characters → send disabled with a visible message (AC-32); Shift+Enter makes
   a newline without sending (AC-27). This one needs no model reply; do not skip it.
4. `no-english.spec.ts`: extend the Polish-text check to the LLM chat screen after spec 1's reply
   (no enum constants like `NEEDS_MANUAL_REVIEW`, `ACCEPT`, `REJECT` visible) (AC-37).

Run: `npm run build`, then `E2E_REAL_LLM=1 npm run test:e2e` (all specs) and plain
`npm run test:e2e` (LLM specs skipped). Report both counts separately, the grep
`grep -rn "page.route" e2e`, and make sure no server you started is left running. Do not commit.
