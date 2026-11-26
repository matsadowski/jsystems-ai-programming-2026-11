# Brief hsdc-poc-T07 — In-memory case store

Read `docs/.agent-briefs/hsdc-poc-common.md` first.

**Goal.** Implement `InMemoryCaseRepository` (the `CaseRepository` interface in
`app/src/server/domain/ports.ts`) per ADR 001 §3.4 and §6.3 (`docs/ADR/001-backend-api.md`).
PRD AC-35, AC-36.

**Editable files (only these):** `app/src/server/store/in-memory-case-repository.ts`,
`app/src/server/store/in-memory-case-repository.test.ts`, `app/src/server/store/index.ts`.

**Concurrent tasks (do not touch):** T05 `app/src/server/{config,http,log}/**`; T09
`app/src/server/ai/*`; T15 `app/src/app/*`, `app/src/components/*`.

**Requirements**
- Constructor: `new InMemoryCaseRepository({ ttlMinutes, maxCases, clock })` where `clock` is
  `Clock` from `@/server/domain/clock` (`{ now(): Date }`).
- Backed by `Map<string, Case>`. Lazy TTL purge on every `get` and `create`: drop entries with
  `now − lastAccessAt > ttlMinutes` (strictly greater). No timers.
- `get(id)` returns the case and sets `lastAccessAt = now` (ISO string), or `null`.
- `create(c)`: purge, insert, then while `size > maxCases` evict the entry with the oldest
  `lastAccessAt`.
- `update(id, mutator)`: synchronous read-modify-write; refreshes `lastAccessAt`; returns the new
  case or `null` if missing/expired.
- `delete(id)`, `size()`.
- `tryAcquireChat(id)`: if the case is missing → false. If `chatInProgress` is true and
  `chatStartedAt` is less than 90 s ago → false. Otherwise set `chatInProgress=true`,
  `chatStartedAt=now` and return true (a flag ≥ 90 s old is stale and taken over).
  `releaseChat(id)`: set `chatInProgress=false`, `chatStartedAt=null`.
- `src/server/store/index.ts`: `getCaseRepository(config?)` returning a `globalThis` singleton
  (key `__hsdcCaseRepository`) built with `systemClock` and the TTL/capacity values passed in
  (default 120 / 200). Do not import `server/config` (T05 is building it concurrently); the caller
  passes the values.

**Failing tests first** (use `fixedClock` from `app/tests/helpers/clock.ts`; build a minimal valid
`Case` object in a test factory):
1. Create, advance 121 min, `get` → `null`. Create, advance 119 min, `get` (refreshes), advance
   119 min again, `get` → still present.
2. Capacity: max 3, create 4 → the oldest-accessed is evicted; a recently `get` entry survives.
3. `update` applies the mutator and returns the updated case; unknown id → `null`.
4. Busy flag: acquire → true; second acquire → false; advance 91 s → acquire → true (stale);
   release → acquire → true. Unknown id → false.
5. `getCaseRepository()` returns the same instance on repeated calls.

Run `npx vitest run src/server/store` from `app/`, then `npm run test`, `npm run lint`,
`npm run typecheck`. Do not commit. Report per the common rules.
