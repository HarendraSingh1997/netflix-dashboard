# Plan 002: Report true watch-hours on the Overview tab

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: this repo has no git history, so there is no
> planned-at SHA. Confirm the "Current state" excerpts match the live files
> (same derivations in `src/tabs/Overview.tsx`). On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-topn-limit-plus-test-harness.md (reuses its Vitest harness for the new tests)
- **Category**: bug
- **Planned at**: no git repo; drift-check via excerpts. Date: 2026-09-18
- **Issue**: omit

## Why this matters

The Overview "Watch time over time" chart and its "peak month" insight are
computed from playback *record counts*, not durations: each record is treated
as one second (`count / 3600` hours). The Viewing tab correctly sums
`Duration` per month, so the two tabs contradict each other on the same export
(e.g. ~126k records renders as ~35 "hours" on Overview while Viewing reports
~1212 days of real watch time). One derivation change aligns them.

## Current state

- `src/tabs/Overview.tsx:15-17`:
  ```ts
  const totalSeconds = viewing.reduce((sum, row) => sum + toSeconds(row.Duration), 0)
  const spend = totalsByCurrency(billing)
  const trend = monthlySeries(viewing, 'Start Time').map((d) => ({ month: d.month, hours: Math.round(Number(d.value) / 360) / 10 }))
  ```
  `monthlySeries` without a `value` fn counts rows (`src/lib/analytics.ts:62-69`
  sets `amount = 1`), so `hours` here is really `records / 3600`.
- `src/tabs/Overview.tsx:26-28`:
  ```ts
  const months = monthlySeries(viewing, 'Start Time')
  const peak = months.reduce((a, b) => (Number(b.value) > Number(a.value) ? b : a), months[0])
  if (peak) out.push(`${peak.month} was the peak month with ${fmtDuration(Number(peak.value))} recorded.`)
  ```
  `fmtDuration` takes *seconds* (`src/lib/utils.ts:34-43`); it receives a record
  count — a second, independent instance of the same bug.
- Reference (correct) implementations to match:
  - `src/tabs/Viewing.tsx:63` — `monthlyViewing(...)` which sums
    `toSeconds(row.Duration) / 3600` per month (`src/lib/analytics.ts:3-22`).
  - `src/tabs/Billing.tsx` and `src/tabs/Games.tsx` — pass a `value` fn into
    `monthlySeries` (e.g. Games: `value: (row) => toSeconds(row.Duration) / 60`).
- The chart renders `trend[].hours` with unit `"h"` (`src/tabs/Overview.tsx:55`
  area). Keep the `{ month, hours }` shape and the unit — only the numbers change.
- Conventions: derivations are plain expressions (React Compiler memoizes; do NOT
  add `useMemo`/`useCallback`/`memo`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc -b`             | exit 0, no errors |
| Tests     | `npm test`               | all pass, incl. new Overview cases |
| Lint      | `npm run lint`           | 0 errors (pre-existing warnings acceptable) |
| Build     | `npm run build`          | `✓ built` |

## Scope

**In scope** (the only files you should modify):
- `src/tabs/Overview.tsx` (trend + peak derivations only)
- `src/lib/overview.test.ts` (create) — or co-locate cases in the plan-001 test file's style; prefer a new `overview.test.ts` testing via exported helpers if you extract any, else test through `monthlySeries` + `toSeconds` composition

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/analytics.ts` — no helper changes needed; `monthlySeries` already supports `value`.
- `src/tabs/Viewing.tsx` and every other tab.
- Copy/wording of the insight strings beyond the corrected numbers.
- E2E scripts in `scripts/`.

## Git workflow

No git repo exists. Do not init one, commit, or push. Leave only in-scope files modified.

## Steps

### Step 1: Derive the trend from durations

Replace the count-based trend with a duration-based one, mirroring the
Billing/Games pattern:
```ts
const trend = monthlySeries(viewing, 'Start Time', {
  value: (row) => toSeconds(row.Duration),
}).map((d) => ({ month: d.month, hours: Math.round(Number(d.value) / 36) / 100 }))
```
(`seconds / 3600` hours at 0.01h resolution; keeps the `{ month, hours }` shape
the chart consumes.)

**Verify**: `npx tsc -b` → exit 0.

### Step 2: Derive the peak from the same duration series

Replace lines 26–28 so the peak month and its formatted duration come from
seconds, not counts:
```ts
const peak = trend.reduce((a, b) => (b.hours > a.hours ? b : a), trend[0])
if (peak) out.push(`${peak.month} was the peak month with ${fmtDuration(peak.hours * 3600)} recorded.`)
```
Guard: if `trend` is empty, `trend[0]` is `undefined` — keep the existing
`if (peak)` guard (it already handles this) and do not add new branches.

**Verify**: `npx tsc -b` → exit 0.

### Step 3: Lock the fix with unit tests

Add cases (in the plan-001 Vitest harness) using small synthetic `viewing` rows
with known `Duration` values (`"1:00:00"`, `"30:00"`, `"90"`):
1. Monthly `hours` equal total durations per month (not row counts) — include a
   month with many short rows vs one with few long rows to prove it.
2. Peak insight inputs: max-hours month wins even when another month has more rows.
3. Empty `viewing` → empty trend, no insight (no crash on `trend[0]`).
4. Cross-check: monthly totals equal `monthlyViewing` output for the same rows
   within float rounding.

**Verify**: `npm test` → all pass (old + new). `npm run lint` → 0 errors.

### Step 4: Full verification

**Verify**: `npm run build` → `✓ built`. If a real Netflix export folder is
available on the machine, optionally run `node scripts/smoke.mjs` → all PASS
and confirm Overview and Viewing monthly totals agree; otherwise skip E2E and
say so in the final report.

## Test plan

Covered in Step 3. Pattern: pure-function cases in the plan-001 harness style
(`describe`/`it`, synthetic rows, no DOM/store imports).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -b` exits 0
- [ ] `npm test` exits 0, including the 4 new duration-vs-count cases
- [ ] `grep -n "Number(d.value) / 360" src/tabs/Overview.tsx` returns no matches (old scaling gone)
- [ ] `grep -n "fmtDuration(Number(peak.value))" src/tabs/Overview.tsx` returns no matches
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- The Overview excerpts don't match the live file (drift).
- Duration-based monthly totals do NOT agree with `monthlyViewing` on the same
  rows (the core assumption — means a helper semantic changed).
- The fix appears to require touching `analytics.ts` or any other tab.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If per-profile monthly hours are ever added to Overview, reuse the same
  `value`-fn pattern — do not reintroduce count-based scaling.
- Reviewer: compare the new Overview chart values against Viewing's "Watch-time
  trend" for the same export; shapes must match, magnitudes must be in the same
  unit (hours).
- Future `monthlySeries` changes (e.g. single-pass bucketing) must preserve the
  `value`-fn contract this fix relies on.
