# Plan 001: Honor the `topN` limit and establish the unit-test harness

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this repo has no git history, so there is no
> planned-at SHA. Instead, confirm the "Current state" excerpts below match
> the live files (same functions, same line neighborhoods). On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (this plan creates the test harness that plans 002 and 003 reuse)
- **Category**: bug + tests
- **Planned at**: no git repo; drift-check via excerpts. Date: 2026-09-18
- **Issue**: omit

## Why this matters

`topN(items, key, _count?)` accepts a limit and ignores it, so every "Top 10"
ranked list (Most played titles, All queries, Sessions by platform, …) renders
the full distinct-value list — thousands of rows through a full `DataGrid`
(sort/filter/facets/virtualizer) where 10 were intended. Fixing the slice is a
one-line change, but there is no unit-test runner in the repo, so this plan
also adds the Vitest harness that later plans depend on.

## Current state

- `src/lib/utils.ts` — aggregation/format helpers. The buggy function (~lines 82–89):
  ```ts
  export function topN<T>(items: T[], key: (item: T) => string, _count?: number): { name: string; value: number }[] {
    const totals = new Map<string, number>()
    for (const item of items) {
      const name = key(item)
      if (name) totals.set(name, (totals.get(name) ?? 0) + 1)
    }
    return [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }
  ```
  Note: falsy keys are excluded from counting; surviving rows are sorted
  value-descending with a stable sort (insertion order = first-seen). Preserve both.
- Callers pass limits that are silently dropped (8 sites), e.g.:
  - `src/tabs/Overview.tsx:57` — `topN(viewing, (row) => row.Title, 10)`
  - `src/tabs/Overview.tsx:58` — `topN(viewing, (row) => row['Profile Name'], 12)`
  - `src/tabs/Devices.tsx:30` — two `topN(..., 10)` calls concatenated
  - `src/tabs/Messages.tsx:14,15` — limits `10` and `5`
  - `src/tabs/Ratings.tsx:68`, `src/tabs/Games.tsx:67`, `src/tabs/Profiles.tsx:80`
- `src/components/ui.tsx:36-40` — `BarList` feeds its `data` prop straight into a
  `DataGrid`, so shrinking `data` shrinks rendered rows 1:1. No BarList change needed.
- `package.json:6-11` — scripts are `dev`, `build` (`tsc -b && vite build`),
  `lint` (oxlint), `preview`. No test runner, no test script. Vitest is not installed.
- Conventions: 2-space indent, single quotes, no semicolons (match `utils.ts`);
  brand/UI copy untouched by this plan.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0 |
| Typecheck | `npx tsc -b`             | exit 0, no errors |
| Tests     | `npm test`               | all pass (after step 2 wires the script) |
| Lint      | `npm run lint`           | 0 errors (5–9 pre-existing warnings are acceptable; do not introduce new ones) |
| Build     | `npm run build`          | `✓ built` |

## Scope

**In scope** (the only files you should modify):
- `src/lib/utils.ts` (the `topN` slice + rename)
- `package.json` + `package-lock.json` (devDependency `vitest`, `test` script)
- `src/lib/utils.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- Any tab file — callers need no changes; they already pass the limit.
- `src/lib/analytics.ts` (`monthRange` duplication is plan material elsewhere, not here).
- E2E scripts in `scripts/` — leave their assertions alone.
- Public response/data shapes — none change; output rows keep `{ name, value }` shape and order for the un-limited case.

## Git workflow

No git repo exists in this project. Do not init one, commit, or push. Leave the
working tree with only the in-scope files modified.

## Steps

### Step 1: Add the Vitest harness

Install Vitest as a dev dependency and wire the `test` script:
- Run `npm install -D vitest`.
- In `package.json` scripts add `"test": "vitest run"`. Do not add watch-mode or
  coverage flags; keep the runner zero-config (it reuses `vite.config.ts`).

**Verify**: `npm test` → exits non-zero with "No test files found" (proves the
runner works and finds nothing yet). `npx tsc -b` → exit 0.

### Step 2: Fix `topN` and rename the parameter

In `src/lib/utils.ts`, change the signature `_count?: number` → `count?: number`
and slice the ordered result when defined:
```ts
export function topN<T>(items: T[], key: (item: T) => string, count?: number): { name: string; value: number }[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    const name = key(item)
    if (name) totals.set(name, (totals.get(name) ?? 0) + 1)
  }
  const ranked = [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  return count === undefined ? ranked : ranked.slice(0, Math.max(0, count))
}
```
Behavior contract: `count === undefined` returns everything (unchanged order);
`count = 0` returns `[]`; negative counts clamp to `[]`; falsy keys still excluded.

**Verify**: `npx tsc -b` → exit 0. `grep -rn "_count" src/lib/utils.ts` → no matches.

### Step 3: Cover `topN` with unit tests

Create `src/lib/utils.test.ts` (Vitest, `import { describe, expect, it } from 'vitest'`,
`import { topN } from './utils'`). Cases:
1. Respects the limit: 5 distinct keys with skewed counts, `count = 2` → top 2 only, still value-descending.
2. No limit (`undefined`) returns all rows in the pre-fix order (guards the rename).
3. Falsy keys (`''`) excluded from counting and from the total.
4. Empty input → `[]`.
5. `count = 0` → `[]`; `count` larger than distinct keys → all rows.
6. Ties keep first-seen order (stable sort check).

**Verify**: `npm test` → all 6+ tests pass. `npm run lint` → 0 errors.

### Step 4: Full verification

**Verify**: `npm run build` → `✓ built`. `npm test` → all pass.
(E2E scripts in `scripts/` require a private Netflix export on disk; do not run
them unless such a folder is available — unit tests plus build are the gate here.)

## Test plan

Covered in Step 3. No existing test file to model after (this plan creates the
first one); keep cases table-driven and free of DOM/router/store imports.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b` exits 0
- [ ] `npm test` exits 0; `src/lib/utils.test.ts` exists with ≥6 passing cases
- [ ] `grep -rn "_count" src/` returns no matches
- [ ] Only in-scope files modified (compare against the Scope list above)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- The `topN` body in `src/lib/utils.ts` doesn't match the excerpt (drift).
- Any caller is found to depend on receiving *more* than the requested rows
  (e.g. an insight reading `types[9]` with limit 10 still fine; anything indexing
  past the limit is a real conflict — report it).
- `npm install -D vitest` fails (registry offline) — report instead of vendoring.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If a "top N + Other bucket" semantic is ever wanted, add it as a new function;
  do not change `topN`'s slice contract — 8 call sites depend on it.
- Plans 002 and 003 add test files reusing this harness (`npm test` must keep
  passing as they land).
- Reviewer: check the `Math.max(0, count)` clamp and that no caller passes a
  non-integer count.
