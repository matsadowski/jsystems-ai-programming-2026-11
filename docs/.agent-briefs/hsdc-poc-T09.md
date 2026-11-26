# Brief hsdc-poc-T09 — Decision guardrails and first-message renderer

Read `docs/.agent-briefs/hsdc-poc-common.md` first.

**Goal.** Pure, fully tested `checkDecision` (G1–G6), `fallbackDecision`, an expired-window
decision builder, and `renderFirstMessage`. Specs: ADR 002 §5.2–5.4 (`docs/ADR/002-ai-pipeline.md`),
§4.2–4.4, TAC-002-01 and TAC-002-06 (§10); ADR 004 §7.2 (expired window decided by code); PRD
AC-17–AC-24 and §11.5 (`docs/PRD.md`). Read those sections fully.

**Editable files (only):** `app/src/server/ai/guardrails.ts`, `app/src/server/ai/guardrails.test.ts`,
`app/src/server/ai/render-first-message.ts`, `app/src/server/ai/render-first-message.test.ts`.

**Concurrent tasks (do not touch):** T05 `app/src/server/{config,http,log}/**`; T07
`app/src/server/store/**`; T15 `app/src/app/*`, `app/src/components/*`, `docs/design-guidelines.md`.

**Contracts to use** (do not edit): `DecisionOutput`, `ImageAnalysis`, `ReturnImageAnalysis`,
`ComplaintImageAnalysis` from `@/server/ai/schemas`; `Decision`, `DecisionFacts` from
`@/server/domain/case`; `CaseType`, `decisionValuesFor`, `decisionLabel`, `CASE_TYPE_LABELS`,
`CATEGORY_LABELS` from `@/lib/shared`.

**API to implement**
```ts
export type ViolationCode = "NOT_ALLOWED" | "WINDOW_EXPIRED_NOT_REJECTED" |
  "INSUFFICIENT_EVIDENCE_NOT_REVIEW" | "DEFECT_NOT_VISIBLE_NOT_REVIEW" | "UNKNOWN_CLAUSE" |
  "MISSING_EVIDENCE_EMPTY" | "ACCEPT_WITH_VISIBLE_USE";
export interface Violation { code: ViolationCode; message: string } // plain English, for the corrective prompt
export interface GuardrailContext {
  caseType: CaseType; facts: DecisionFacts;
  analysis: ImageAnalysis | null;      // null on RULES/FAST paths → G3/G3c/G6 skipped
  clauseIds: ReadonlySet<string>;      // parsed policy clause IDs (T08 provides them later)
}
export function checkDecision(output: DecisionOutput, ctx: GuardrailContext): Violation[];
export function expiredWindowDecision(caseType: CaseType, facts: DecisionFacts, source: "RULES" | "GUARDRAIL"): Decision;
export function fallbackDecision(ctx: GuardrailContext, violations: Violation[]): Decision; // source GUARDRAIL
```
- Evaluate rules in the order of 002 §5.2. G2 takes precedence over G3 (when the window is expired,
  report G2 and do not report G3/G3c/G6). `NOT_PHOTOGRAPHABLE` never triggers G3c.
- `fallbackDecision`: if any violation is `WINDOW_EXPIRED_NOT_REJECTED` (or `facts.withinWindow` is
  false) → `expiredWindowDecision(…, "GUARDRAIL")`; otherwise `NEEDS_MANUAL_REVIEW` with
  `[R4.1]`/`[C4.2]` and `missingEvidence` from the analysis `qualityIssues` translated to Polish
  (BLURRY → "Wyraźniejsze, ostre zdjęcie", TOO_DARK → "Zdjęcie przy lepszym oświetleniu",
  OVEREXPOSED → "Zdjęcie bez prześwietlenia", PARTIAL_VIEW → "Zdjęcie całego urządzenia",
  OBSTRUCTED → "Zdjęcie bez zasłoniętych elementów", LOW_RESOLUTION → "Zdjęcie w wyższej
  rozdzielczości"), or else "Automatyczna ocena była niespójna — wymagana ocena pracownika".
- `expiredWindowDecision` follows 002 §5.3 "G2 violated" text exactly (the justification sentence
  with {n} and "14 dni" / "24 miesiące", plus the return/complaint extra sentence), with
  `citedClauses` `[R1.3]`/`[C1.3]`. Choose 1–2 Polish `nextSteps` that cite the clause (e.g.
  "Poinformuj klienta, że termin na zwrot upłynął (pkt R1.3)."). `confidence: "HIGH"`,
  `violationsOnFirstAttempt: []`. Every produced decision must itself pass `checkDecision`
  (assert this in tests, with clause IDs including R1.3, R4.1, C1.3, C4.2).
- `renderFirstMessage(args: { caseType, category, model, purchaseDate, facts, decision }): string`
  renders the 002 §5.4 Markdown in that exact order. Use the decision label from `decisionLabel`.
  Date shown as `DD.MM.YYYY`. Section "Brakujące informacje" only for `NEEDS_MANUAL_REVIEW`.
  The disclaimer (italic) must be byte-exact:
  "Decyzja jest rekomendacją wygenerowaną przez AI na podstawie zdjęcia, danych zgłoszenia i
  regulaminu. Ostateczną decyzję podejmuje pracownik." (one line, no line break).
  Escape model-provided strings: a leading `#`, `>`, `<` (after optional spaces) is backslash-escaped,
  and newlines inside a bullet are collapsed to spaces so a bullet cannot start a new block.
  Also export `firstMessageUIMessage(id, markdown)` returning
  `{ id, role: "assistant", parts: [{ type: "text", text: markdown }] }` (type `TextUIMessage`
  from `@/lib/shared/api`).

**Failing tests first:** every G-rule positive and negative case; G2-over-G3 precedence;
NOT_PHOTOGRAPHABLE; analysis `null`; each fallback variant (return/complaint × expired/other,
with and without qualityIssues); every decision value of both case types rendered (order of sections
asserted by index, disclaimer exact, "Brakujące informacje" presence rule, `<script>` / `# heading`
injection in a justification escaped). Reach **100% branch coverage** of `guardrails.ts`: run
`npx vitest run --coverage --coverage.include=src/server/ai/guardrails.ts src/server/ai/guardrails.test.ts`
and include the coverage line in your report.

Do not commit. Report per the common rules.
