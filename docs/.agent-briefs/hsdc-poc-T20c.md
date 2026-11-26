# Brief hsdc-poc-T20c — Realistic eval names and the Luna eval part

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Decisions D11 (Luna is back, default mode
`shadow`) and D12 (realistic model names) apply.

**Editable files (only):** `app/evals/cases.ts` (+ test), `app/evals/run.ts`, `app/evals/run-lib.ts`
(+ test), `app/evals/lib/report.ts` (+ test) if the Luna section needs it.

1. **Model names (D12).** In the matrix and every targeted case use the declared model per file:
   `laptop-1.png` → "Microsoft Surface Laptop", `laptop-2.webp` → "Lenovo ThinkPad",
   `phone-1.jpg` → "Apple iPhone", `phone-2.jpeg` → "Apple iPhone Pro", `phone-3.jpeg` →
   "Samsung Galaxy S24 Ultra". The category-mismatch case keeps its deliberate mismatch (phone photo
   declared as `CAMERA`) — use a camera model name for it, e.g. "Canon EOS R50". No name may
   describe the device's condition. Update tests.
2. **`--luna` (ADR 004 §6).** Remove the D9 "unavailable" stub. With `--luna`, for every matrix cell
   × runs (and the "nie włącza się" complaint case): call Luna once via `createAssessWithLuna`
   (from `app/src/server/cases/deps.ts`, real `callLuna`) on the processed image, record raw
   `LunaAnswer[]`, eligibility, latency and `costUsd` (Luna reports `usage.cost`; with a BYOK key
   use `cost_details.upstream_inference_cost` if `cost` is 0, like the LLM tap), then run the LLM
   pipeline independently without hints as the reference (reuse the matrix run when both run in the
   same invocation). Feed `evaluateThresholds` (T20a) and render the threshold table, the
   recommendation and the exit criteria in the report's Luna section. Budget checks apply to Luna
   calls too. A Luna error is recorded per run (not fatal).
3. Tests first for the new pure parts (names in cases, mapping run results into the
   `evaluateThresholds` input, cost extraction for Luna bodies using the real captures
   `luna-return-phone-1`/`luna-complaint-laptop-2`). No real calls in tests.

**Do not run the real eval** — the orchestrator runs it. Run `npm run test`, lint, typecheck.
Do not commit. Report per the common rules, including the exact command to run.
