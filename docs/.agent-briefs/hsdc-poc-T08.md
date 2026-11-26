# Brief hsdc-poc-T08 — Policy loader and clause parser

Follow the attached common rules (`hsdc-poc-common.md`).

**Goal.** Load both policy Markdown files from a directory, compute a version hash, parse clause
IDs. Specs: ADR 000 §8.6, ADR 002 §3.1 (`policies.ts` row) and §10 "Clause parser" row.

**Editable files (only):** `app/src/server/policies/policies.ts` and
`app/src/server/policies/policies.test.ts`. Nothing else.

**Concurrent tasks (do not touch):** `app/src/server/image/**`, `app/src/server/decisions/**`,
`app/src/components/**`.

**API**
```ts
import "server-only";
export type PolicyCaseType = "RETURN" | "COMPLAINT";
export interface Policy { text: string; version: string; clauseIds: ReadonlySet<string> }
export function parseClauseIds(markdown: string): Set<string>;
export function loadPolicies(policyDir: string): { RETURN: Policy; COMPLAINT: Policy };
export function getPolicy(caseType: PolicyCaseType, policyDir: string): Policy; // cached per dir
export function resetPolicyCache(): void;
```
- Files: `return-policy.md` (RETURN) and `complaint-policy.md` (COMPLAINT) in `policyDir`
  (`node:fs` `readFileSync`, utf8).
- `version`: first 12 hex chars of the SHA-256 of the file text (`node:crypto`).
- `parseClauseIds`: collect (a) every bold identifier at the start of a bold span, i.e. the regex
  `/\*\*([RC]\d+\.\d+)\b/g` (note `**C2.1 Covered**` must yield `C2.1`), and (b) section headings
  `## R1.` / `## C6.` → `R1`, `C6` (regex `/^##\s+([RC]\d+)\./gm`).
- A missing file → throw `ConfigError` from `@/server/http/errors` with `detail` naming the
  missing path. Import `ConfigError` exactly: `import { ConfigError } from "@/server/http/errors";`.

**Failing tests first** (read the real files at `path.resolve(__dirname, "../../../../docs/policies")`):
1. Return IDs include R1.1, R1.2, R1.3, R1.4, R2.1, R2.2, R2.3, R2.4, R3.1, R3.2, R4.1 and the
   section ID R5.
2. Complaint IDs include C1.1–C1.4, C2.1–C2.4, C3.1–C3.4, C4.1–C4.3 and section ID C6.
3. `version` is 12 lowercase hex chars and stable across two loads.
4. A temp dir without the files → `ConfigError` (create the temp dir with `fs.mkdtempSync(os.tmpdir())`).
5. `parseClauseIds("- **C2.1 Covered** — x")` contains `C2.1`.

Run from `app/`: `npx vitest run src/server/policies`, then `npm run lint` and `npm run typecheck`.
Do not commit, do not run git add/commit. Report: files changed, failing-first evidence, test counts.
