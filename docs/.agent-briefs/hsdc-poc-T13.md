# Brief hsdc-poc-T13 — Decision router (modes and paths)

Read `docs/.agent-briefs/hsdc-poc-common.md` first.

**Goal.** `router.ts` choosing the decision path per ADR 004 §3.1–3.4, §4.3–4.6, §5, §7.1–7.2,
§8 diagrams and §10 integration rows (`docs/ADR/004-confidence-gated-decisions.md`); PRD AC-40–AC-45
(`docs/PRD.md`). TAC-004-02, -03, -04.

**Editable files (only):** `app/src/server/decisions/router.ts`, `app/src/server/decisions/router.test.ts`.

**Concurrent task (do not touch):** T11a edits `app/src/server/ai/models.ts`,
`app/src/server/ai/prompts/**`, `app/src/server/decisions/luna-client.ts`, `app/scripts/**`,
`app/tests/helpers/replay.ts`.

**Dependencies are injected** (ports in `app/src/server/domain/ports.ts`: `AnalyzeImage`,
`DecideWithLlm`, `AssessWithLuna`). In tests pass **typed fakes** of these ports (our own
interfaces, not external services), plus a call counter. Do not import the AI SDK, `models.ts` or
`luna-client.ts`. The network guard proves no real call happens (TAC-004-03).

Existing pure modules to use: `isFastPathEligible` (`./eligibility`), `assess` (`./certainty`),
`mapToDecision` (`./fast-path`), `expiredWindowDecision` (`@/server/ai/guardrails`),
`computeDecisionFacts` is already done by the caller.

**API (two steps, matching the two endpoints, ADR 004 §5)**
```ts
export interface RouterDeps {
  mode: DecisionMode; threshold: number; lunaTimeoutMs: number;
  analyzeImage: AnalyzeImage; assessWithLuna: AssessWithLuna; decideWithLlm: DecideWithLlm;
  now?: () => number; // for latency measurement in tests
}
// Step 1 (POST /api/cases): returns what the case stores after analysis.
export async function routeAnalysis(deps, args: { caseId; input: CaseInput; image: ProcessedImage; facts: DecisionFacts }):
  Promise<{ decisionPath: DecisionPath; analysis: ImageAnalysis | null; lunaAssessment: LunaAssessment | null;
            preparedDecision: Decision | null; /* RULES/FAST: built now, returned by step 2 */
            shadowFast: ShadowFastResult | null /* shadow only */ }>;
// Step 2 (POST /api/cases/{id}/decision): the decision for a stored case.
export async function routeDecision(deps, c: Case & { preparedDecision?: Decision | null }):
  Promise<{ decision: Decision; shadow: ShadowComparison | null }>;
```
(You may refine names, but keep both steps pure apart from the injected calls, and document the
final signatures at the top of the file. Report any field the `Case` contract lacks — e.g. where
`preparedDecision` is stored — so the orchestrator can extend the contract; until then keep it in
the router's return types.)

**Rules**
- Every mode: `facts.withinWindow === false` → `RULES`, `expiredWindowDecision(caseType, facts, "RULES")`,
  **zero** calls to any dep, in both steps.
- `llm_only`: step 1 calls `analyzeImage` only → `LLM`; step 2 calls `decideWithLlm` without
  `preliminary`.
- `shadow`: step 1 runs `analyzeImage` and `assessWithLuna` **concurrently**; a Luna rejection or
  timeout is swallowed (logged) and never changes the result (`lunaAssessment` null,
  `shadowFast: "UNCERTAIN"`); an `analyzeImage` error propagates as before. Compute `shadowFast`:
  not eligible → `NOT_ELIGIBLE`; not all certain → `UNCERTAIN`; mapping `UNMAPPED` → `UNMAPPED`;
  else the fast decision value. Step 2: `decideWithLlm` **without** `preliminary` (independence),
  then `shadow = { fastDecision: shadowFast, agreesWithLlm: value === llm value or null when
  shadowFast isn't a decision }`. Path `LLM`.
- `gated`: not eligible → `LLM_ESCALATED` without calling Luna (vision called; step 2 LLM). Eligible:
  call Luna first; error/timeout → treat as all uncertain → escalate (vision then step 2 LLM with
  `preliminary: lunaAssessment` when one exists). All certain and mapped → `FAST`, prepared decision
  from `mapToDecision`, **no** vision call; step 2 returns it with no LLM call. Uncertain or
  UNMAPPED → `LLM_ESCALATED`, `uncertainKeys` kept, step 2 LLM gets `preliminary`.
- Never produce `FAST` if any answer is refused, missing or below threshold (TAC-004-02).

**Failing tests first** (Vitest, node): expired return (15 days) and complaint (731 days) in each
mode → RULES + zero dep calls in both steps; llm_only call counts; shadow: Luna rejects / times out
→ result identical to success case, decision from LLM, `decideWithLlm` called without
`preliminary`; shadow comparison agree/disagree/null; gated: FAST (all certain, mapped) → zero
vision/LLM calls; gated escalation on certainty 0.62, on refusal, on Luna timeout, on Luna error,
on UNMAPPED combination → `LLM_ESCALATED` with `preliminary`; gated ineligible (OTHER, return
AUDIO) → no Luna call. Build `LunaAssessment` values with `toLunaAnswer` from raw answer objects
of the documented shapes (`{type:"noul", noul, confidence}` etc.); these are inputs to a pure
function, not network mocks. Report branch coverage of `router.ts`.

Do not commit. Report per the common rules.
