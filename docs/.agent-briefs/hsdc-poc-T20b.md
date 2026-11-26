# Brief hsdc-poc-T20b — Eval runner over the real pipeline and the first run

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Pure parts exist in `app/evals/` (T20a: cases,
budget, invariants, agreement, luna-thresholds, report). Decisions D8/D9: models
`openai/gpt-6-luna`, Luna is down → **no `--luna` run**; the runner prints a clear message if
`--luna` is passed while Luna fails, and the Luna section of the report states "Luna unavailable
(provider outage, D9)".

**Editable files (only):** `app/evals/run.ts`, `app/evals/run-lib.ts` (+ test), `app/package.json`
(replace the `eval` script with `tsx --conditions=react-server evals/run.ts`), `app/AGENTS.md`
(only the `capture`/`eval` row of the commands table if it needs correcting).

**Runner:** loads env with `process.loadEnvFile?.(".env")` at runtime (never print env). For each
matrix cell × 3 runs and each targeted case (002 §6.3 table): run the real pipeline in-process via
the services' building blocks — `processPhoto` → `analyzeImage` → `computeDecisionFacts` →
`routeAnalysis`/`routeDecision` (mode `llm_only`) — and for chat cases `chatStream` on a case built
from a real decision, consuming the stream to collect text and tool calls. Budget: before each
model call `budget.canSpend(estimate)` (estimate from the running mean of reported costs, first
call 0.05 USD); record `providerMetadata.openrouter.usage.cost` (null → unknown). Stop cleanly
when the budget stops; the report records it. Measure latency per step. Write
`app/evals/reports/<YYYY-MM-DD>-<model-slug>.md` via `renderReport` (git-ignored). Print a
one-screen summary.

**Tests first** for `run-lib.ts` (pure glue: argument parsing `--runs N --only <case>`, cost
extraction from a provider-metadata object, building a Case for chat cases, mapping results into
report rows) using captures from `tests/fixtures/llm-captures` where a model result shape is
needed. No real calls in tests.

**Then run it for real** from `app/`: first `npm run eval -- --runs 1 --only targeted` (smoke),
then the full `npm run eval` (3 runs). `EVAL_MAX_COST_USD` stays at its default 5. Report the
report path, total cost, budget stop (if any), targeted case pass/fail list (failures are
reported, never hidden), invariant failures, agreement per cell and the guardrail fallback rate.
Do not commit. Report per the common rules.
