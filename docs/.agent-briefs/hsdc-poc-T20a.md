# Brief hsdc-poc-T20a — Eval runner: pure aggregation, budget and report (no model calls)

Read `docs/.agent-briefs/hsdc-poc-common.md` first. Part **a** of T20. Part b (the runner that
calls the real pipeline and the first real run) needs the user's key and the T14b wiring.

**Specs:** ADR 002 §6.3 incl. amendment A4 (`EVAL_MAX_COST_USD`), TAC-002-04
(`docs/ADR/002-ai-pipeline.md`); ADR 004 §6, TAC-004-01, TAC-004-06
(`docs/ADR/004-confidence-gated-decisions.md`).

**Editable files (only):** `app/evals/lib/**` (+ tests) and `app/evals/cases.ts` (+ test).
`vitest.config.mts` already includes `evals/**/*.test.ts`.

**Concurrent task (do not touch):** T14a edits `app/src/server/cases/**`,
`app/src/server/http/parse-case-form.ts`, `app/src/app/api/**`.

**Modules**
- `evals/cases.ts`: the eval matrix from 002 §6.3 (5 example images × 2 case types, category from
  the file name, purchase date 5 days before an injected "today", the neutral complaint reason) and
  the targeted cases (002 §6.3 table, plus 004 §6 "nie włącza się" and category mismatch), each with
  its asserted expectation as data. Never describe the photo in any text.
- `evals/lib/budget.ts`: `createBudget(maxUsd)` with `canSpend(estimateUsd)`, `record(costUsd | null)`
  (null cost counts as 0 but increments an `unknownCostCalls` counter), `spent`, `stopped`, and
  `stopReason`. The runner must check before each call and stop **before** exceeding (A4).
- `evals/lib/invariants.ts`: `checkInvariants({ caseType, decision, clauseIds, latencyMs, budgetMs })`
  → list of failures: clauses exist; Polish heuristic on justification/nextSteps (Polish diacritics
  or common stop-words present, no sentence that is clearly English — implement a simple,
  documented heuristic); latency within budget. Plus `fallbackRate(results)`.
- `evals/lib/agreement.ts`: per matrix cell with 3 runs, final-decision agreement rate
  (`≥ 2/3` target, reported not failed).
- `evals/lib/luna-thresholds.ts` (004 §6): for thresholds `[0.60, 0.70, 0.80, 0.90, 0.95]`, given
  per run `{ answers: LunaAnswer[], eligible, facts, caseType, referenceDecision }`, compute the
  hypothetical fast decision (use `assess` + `mapToDecision` from `app/src/server/decisions`),
  coverage, agreement on FAST cases, unsafe disagreements (fast `ACCEPT`/`REPAIR`/`REPLACE` vs
  reference `REJECT`/`NEEDS_MANUAL_REVIEW`), and the recommendation per the exit criteria
  (agreement ≥ 95%, zero unsafe, coverage ≥ 30%; lowest threshold meeting them, else "stay in
  shadow"), plus p50/p95 latency and cost per case.
- `evals/lib/report.ts`: `renderReport(...)` → Markdown with run date, models, prompt/policy
  versions, budget spent and any budget stop, per-case table, invariant failures, agreement, the
  threshold table, the recommendation, and the limitation sentence from 004 §6 item 5.

**Failing tests first** for each module with small hand-built inputs (these are our own data
structures, not mocks of external services). Then `npm run test`, lint, typecheck. Do not commit.
Report per the common rules.
