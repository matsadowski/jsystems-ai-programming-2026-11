# Brief hsdc-poc-T10 — Confidence-gated fast-path pure logic

Read `docs/.agent-briefs/hsdc-poc-common.md` first.

**Goal.** Pure modules of ADR 004 (`docs/ADR/004-confidence-gated-decisions.md`): §4.1 question sets,
§4.2 certainty, §4.3 eligibility, §4.4 mapping table. TAC-004-02 (100% branch coverage of
`certainty.ts` and `fast-path.ts`). PRD AC-43, AC-46, AC-47 (read them in `docs/PRD.md`). Read §3.3
and §10 too.

**Editable files (only):** `app/src/server/decisions/questions.ts`, `certainty.ts`, `fast-path.ts`,
`eligibility.ts` and their `*.test.ts` in `app/src/server/decisions/`.

**Concurrent tasks (do not touch):** T06 `app/src/server/image/**`; T07 `app/src/server/store/**`;
T16 frontend form files. Do not create `router.ts` or `luna-client.ts` (T13/T11).

**Contracts** (fixed): `LunaAnswer`, `LunaAssessment`, `Decision`, `DecisionFacts` from
`@/server/domain/case`; `checkDecision`, `GuardrailContext` from `@/server/ai/guardrails` (exists);
`CaseType`, `DeviceCategory`, `CATEGORY_LABELS` from `@/lib/shared`.

**API**
- `questions.ts`: `QUESTIONS_VERSION = "luna-questions@1"`;
  `buildQuestions(caseType, category, model)` → the Decisions API `questions` array for the case
  (common + return or complaint questions; keys, types, `instructions` and `criteria` per §4.1, in
  English; every `instructions` ends with the exact injection sentence from §4.1). Shape per Luna
  docs (see `docs/.agent-briefs/hsdc-poc-T01b-notes.md` §8): `{ key, type: "noul"|"choice"|"score",
  instructions, criteria? }` — keep the shape in one exported type `LunaQuestion` so T11's client
  can adapt it after a real capture. `buildStateText(input)` → the text block of `state` (case type,
  category label, model, and for complaints the reason marked as an unverified employee claim).
  Also export Polish display labels for each key and each answer value (for the UI assessment list,
  e.g. `signs_of_use` → "Ślady użytkowania", bucket 0 → "brak").
- `certainty.ts`: `certaintyOf(raw)` per §4.2 on a raw Luna answer object
  (`{type:"noul", noul, confidence?}`, `{type:"choice", choice, probabilities, confidence?}`,
  `{type:"score", score, probabilities, confidence?}`, `{type:"refusal"}`, missing → `null`);
  `toLunaAnswer(key, raw)` → `LunaAnswer` (noul value = `noul ≥ 0.5`; score value = argmax bucket);
  `assess(answers: LunaAnswer[], threshold)` → `{ allCertain, uncertainKeys, refusedKeys }`
  (certain iff certainty ≥ threshold; null → uncertain; refusal/missing → refusedKeys and uncertain).
- `eligibility.ts`: `isFastPathEligible(caseType, category, facts)` per §4.3 (window expired →
  `false` with reason `"RULES"`; return a discriminated result like
  `{ eligible: true } | { eligible: false, reason: "RULES" | "CATEGORY_OTHER" | "RETURN_AUDIO" }`).
- `fast-path.ts`: `mapToDecision(caseType, facts, answers: LunaAnswer[])` → `Decision` (source
  `"FAST"`) or `"UNMAPPED"`, evaluating §4.4 rows top-down; never `REFUND`; DOA → `REPLACE`.
  Polish `justification` (cite clause IDs in text) and `nextSteps` from templates (R6 for ACCEPT,
  C6 for complaints — read `docs/policies/return-policy.md` and `complaint-policy.md` for those
  clauses); `missingEvidence` non-empty for every `NEEDS_MANUAL_REVIEW`; `confidence: "HIGH"`;
  `violationsOnFirstAttempt: []`. Must only be called when all answers are certain; if any answer
  is missing/refused, return `"UNMAPPED"` (fail closed).

**Failing tests first:** every row of both mapping tables (exact decision + clauses), and each
produced decision passes `checkDecision` with `analysis: null` and the real clause IDs parsed from
the two policy files (read them in the test with `node:fs` and a simple `/\b([RC]\d+(?:\.\d+)?)\b/`
scan of the clause headings — T08 builds the real parser later); `visible`+`no_visible_damage` →
UNMAPPED; certainty per type incl. confidence present/absent; boundary 0.80 certain, 0.7999
uncertain; refusal/missing/unknown type → null; eligibility rows (OTHER, return AUDIO, complaint
AUDIO, expired). Report coverage:
`npx vitest run --coverage --coverage.include=src/server/decisions/certainty.ts --coverage.include=src/server/decisions/fast-path.ts src/server/decisions`
(100% branches required).

Do not commit. Report per the common rules.
