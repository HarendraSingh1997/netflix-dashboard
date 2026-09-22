# Plan 003: Rank Devices regions once from combined streaming + login counts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this repo has no git history, so there is no
> planned-at SHA. Confirm the "Current state" excerpts match the live files.
> On mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-topn-limit-plus-test-harness.md (reuses its Vitest harness; also benefits from its `topN` limit so the two halves are bounded)
- **Category**: bug
- **Planned at**: no git repo; drift-check via excerpts. Date: 2026-09-18
- **Issue**: omit

## Why this matters

"Activity by region" concatenates two independently ranked lists, so the same
region appears as two separate bars with partial counts (streaming-only and
login-only) instead of one combined total — and each half is currently
unbounded (see plan 001). Aggregating first and ranking once gives one bar per
region with the true total.

## Current state

- `src/tabs/Devices.tsx:30`:
  ```ts
  const regions = [...topN(streaming, (row) => row['Region Code Display Name'], 10), ...topN(logins, (row) => row['Region Code'], 10)]
  ```
  Note the two halves use *different fields*: streaming rows key on
  `Region Code Display Name`, login rows on `Region Code`. These are different
  label vocabularies for the same geography.
- Consumer: `src/tabs/Devices.tsx:86-95` — a `SectionTitle` ("Activity by region")
  plus `BarList data={regions} unit=" events"`, rendering `{ name, value }` rows.
  Keep that `{ name, value }` shape — only how it is computed changes.
- Related insight (`src/tabs/Devices.tsx:39-44`) ranks streaming regions alone
  for its top-region sentence; leave it exactly as is (out of scope).
- Conventions: plain expressions (React Compiler memoizes; do NOT add
  `useMemo`/`useCallback`/`memo`); lodash-es is available (`countBy`,
  `groupBy`, `orderBy`, `sumBy` already used in `src/lib/utils.ts`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc -b`             | exit 0, no errors |
| Tests     | `npm test`               | all pass, incl. new region cases |
| Lint      | `npm run lint`           | 0 errors (pre-existing warnings acceptable) |
| Build     | `npm run build`          | `✓ built` |

## Scope

**In scope** (the only files you should modify):
- `src/tabs/Devices.tsx` (the `regions` derivation only — one expression)
- `src/lib/devices-regions.test.ts` (create) — or `src/tabs/devices.test.ts`; test the aggregation helper (extract it as a pure exported function if that keeps the test DOM-free)

**Out of scope** (do NOT touch, even though they look related):
- The top-region insight sentence (`Devices.tsx:39-44`) — streaming-only by design.
- `src/lib/analytics.ts`, `src/lib/utils.ts` (`topN` semantics are plan 001's).
- `BarList`, `GeoMap`, and every other tab.
- E2E scripts in `scripts/`.

## Git workflow

No git repo exists. Do not init one, commit, or push. Leave only in-scope files modified.

## Steps

### Step 1: Combine counts by normalized region, then rank once

Replace the concatenation with a single aggregation. Normalize each row to one
key, preferring the display name and falling back to the code:
```ts
const regionKey = (row: Row) => row['Region Code Display Name'] || row['Region Code'] || ''
const regions = orderBy(
  Object.entries(countBy([...streaming, ...logins], regionKey)).map(([name, value]) => ({ name, value })),
  ['value'],
  ['desc'],
).filter((row) => row.name !== '')
```
(`Row`, `countBy`, `orderBy` imports: `Row` type comes from `../lib/store` or
`../lib/utils` — check the file's existing imports and match them; lodash from
`lodash-es`.) After plan 001, `topN` is no longer needed here; do not reintroduce it.

**Verify**: `npx tsc -b` → exit 0.

### Step 2: Lock the fix with unit tests

Cases (synthetic streaming + login rows):
1. A region present in both lists yields ONE row with the summed count.
2. Streaming-only and login-only regions each appear once with their own count.
3. Rows with neither field set are excluded (no blank bar).
4. Ordering is value-descending.
5. Empty inputs → `[]`.

**Verify**: `npm test` → all pass (old + new). `npm run lint` → 0 errors.

### Step 3: Full verification

**Verify**: `npm run build` → `✓ built`. If a real Netflix export is available,
optionally run `node scripts/smoke.mjs` → all PASS and eyeball that "Activity
by region" shows each region once; otherwise skip E2E and say so.

## Test plan

Covered in Step 2. Extract the aggregation into a small pure helper in the tab
file (or `src/lib/`) so tests stay DOM-free; model cases on the plan-001 test style.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b` exits 0
- [ ] `npm test` exits 0, including the 5 new region cases
- [ ] `grep -n "topN(streaming" src/tabs/Devices.tsx` returns no matches (concat gone)
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- The `regions` line doesn't match the excerpt (drift).
- `Region Code Display Name` and `Region Code` turn out to be incompatible
  vocabularies that cannot be merged by fallback (e.g. codes that collide with
  unrelated display names) — report with examples instead of inventing a mapping.
- The fix appears to require touching `BarList`, `GeoMap`, or `utils.ts`.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If login/streaming region fields are ever unified upstream, simplify
  `regionKey` to the single field — the tests pin the fallback order.
- Reviewer: check the merged ranking against the old two-list output for the
  same export; totals per region should equal the sum of the two old partial bars.
- The GeoMap per-region drill (`src/components/GeoMap.tsx`) keeps its own
  grouping; unifying the two is explicitly deferred, not forgotten.
