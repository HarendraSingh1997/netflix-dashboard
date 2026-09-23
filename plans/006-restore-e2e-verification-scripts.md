# Plan 006: Restore the E2E verification scripts so they exercise the current UI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4fc7036..HEAD -- scripts/smoke.mjs scripts/verify-charts.mjs scripts/verify-chips.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `4fc7036`, 2026-09-23

## Why this matters

The repo documents `node scripts/smoke.mjs`, `node scripts/verify-charts.mjs`,
and `node scripts/verify-chips.mjs` as its browser-level verification, and
`AGENTS.md` lists them as commands. They currently cannot pass: their selectors
target UI that was replaced when the day/hour heatmap became the per-session
heatmap (`src/components/Heatmap.tsx`) and when the tab bar became the left
sidebar (`src/components/Sidebar.tsx`). Every later change to this repo is
supposed to be verified against a real export, and right now that harness
fails before it tests anything. This plan repairs the harness so the remaining
plans have a real verification story.

## Current state

- `scripts/smoke.mjs` — full 11-tab sweep. Line 35-37 is the Viewing tab check
  list entry; lines 61-69 interact with the old heatmap:
  ```js
  const TAB_CHECKS = [
    ['Viewing', 'When you watch'],
    ...
  ]
  // ...
  // Heatmap: click a weekday row button to open drill-down dialog
  await page.getByRole('button', { name: /View all \w+ sessions/ }).first().click()
  await page.getByRole('dialog').waitFor({ timeout: 15000 })
  console.log('PASS: heatmap row opens drill-down dialog')
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  // Heatmap: click an hour cell
  await page.getByRole('button', { name: /View sessions for \w+ \d\d:00/ }).first().click()
  ```
  "When you watch (UTC) — select any day or hour cell" and the day/hour cell
  grid no longer exist. They were replaced by `src/components/Heatmap.tsx`,
  whose section title is "Every session, in order" and whose cells expose
  `aria-label="View session: <start> UTC — <title> (<profile>, <duration>)"`.
- `scripts/verify-charts.mjs` — lines 38-40 repeat the same dead heatmap-row
  interaction.
- `scripts/verify-chips.mjs` — already updated to the sidebar (`getByRole('navigation', { name: 'Dashboard sections' })`) and is the exemplar to match.
- The sidebar already migrated correctly: `scripts/smoke.mjs:49` uses
  `page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: label, exact: true }).click()`.
- The Ask tab is intentionally disabled (`src/App.tsx:182`); its `smoke.mjs`
  check is already commented out. Leave it commented.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck + build | `npm run build` | `✓ built` |
| Lint | `npm run lint` | 0 errors (warnings allowed) |
| Unit tests | `npm test` | 49 tests pass |
| Smoke (needs real export) | `node scripts/smoke.mjs` | every line `PASS:` |
| Charts (needs real export) | `node scripts/verify-charts.mjs` | every line `PASS:` |
| Chips (needs real export) | `node scripts/verify-chips.mjs` | every line `PASS:` |

E2E scripts require a built `dist/` **and** a real extracted Netflix export
folder. Both `smoke.mjs` and `verify-charts.mjs` currently hardcode
`const EXPORT = '/Users/harendrasingh/Downloads/Netflix Member Information Request (HR)'`.
If that path does not exist on the executing machine, stop and report — do not
fabricate an export. A real export is PII; it must never be committed or copied
into the repo.

## Scope

**In scope** (the only files you should modify):
- `scripts/smoke.mjs`
- `scripts/verify-charts.mjs`

**Out of scope** (do NOT touch):
- `scripts/verify-chips.mjs` — already correct.
- `src/**` — this plan changes no application code.
- `.env`, any export data, `screenshots/`.

## Git workflow

- Branch: `advisor/006-e2e-selectors`
- Commit style in this repo: conventional commits, e.g.
  `fix: readable Profile → device Sankey on Viewing tab`, `chore: temporarily disable Ask tab (commented, engine intact)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the Viewing tab check entry in `smoke.mjs`

In the `TAB_CHECKS` array, change the Viewing entry's expected text from
`'When you watch'` to a string that still exists in the current Viewing tab.
`'Watch-time trend (all months'` is used by `verify-charts.mjs:33` and is
present at `src/tabs/Viewing.tsx:144`.

**Verify**: `grep -n "When you watch" scripts/smoke.mjs` → no matches.

### Step 2: Replace both heatmap interactions in `smoke.mjs`

Delete the two dead heatmap blocks (the weekday-row click and the hour-cell
click, currently lines 61-69). Replace them with a single interaction against
the current per-session heatmap:

```js
// Heatmap: click a session cell to open that day's drill-down
await page.getByRole('button', { name: /^View session: / }).first().click()
await page.getByRole('dialog').waitFor({ timeout: 15000 })
console.log('PASS: session cell opens drill-down dialog')
await page.getByRole('button', { name: 'Close', exact: true }).click()
```

Before clicking, wait for the heatmap section to exist so the cell is attached:
`await page.getByText('Every session, in order').waitFor({ timeout: 60000 })`.
Place that wait where the old blocks were — after the "trend line chart renders"
log and before the "heatmap row opens" block.

**Verify**: `grep -n "View all \|View sessions for" scripts/smoke.mjs` → no matches.

### Step 3: Apply the same replacement in `verify-charts.mjs`

`verify-charts.mjs:38-40` contains only the weekday-row interaction. Replace it
with the same single session-cell interaction, and update its log text to
`PASS: session cell opens drill-down dialog`. Keep the fullscreen-chart and
funnel checks in that file untouched.

**Verify**: `grep -n "View all " scripts/verify-charts.mjs` → no matches.

### Step 4: Run the full gate

```sh
npm run build && npm run lint && npm test
```

Then, if a real export is available at the path in `EXPORT`:

```sh
node scripts/smoke.mjs
node scripts/verify-charts.mjs
node scripts/verify-chips.mjs
```

Each must print only `PASS:` lines and exit 0.

## Test plan

No new unit tests — this plan changes verification scripts, not application
logic. The scripts themselves are the test. The regression this plan fixes is
"the documented verification commands fail against a valid export"; the proof is
that they now exit 0 on one.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 (49 tests)
- [ ] `grep -rn "When you watch\|View all \|View sessions for" scripts/smoke.mjs scripts/verify-charts.mjs` returns no matches
- [ ] `grep -n "Ask" scripts/smoke.mjs` shows the Ask check still commented out
- [ ] No `src/**` file is modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/tabs/Viewing.tsx` no longer contains the string `Watch-time trend (all months`.
- `src/components/Heatmap.tsx` no longer exposes `aria-label` values starting with `View session:` — that means the heatmap was replaced again and the correct selectors must be re-derived from the new component.
- The `EXPORT` path in the scripts does not exist on this machine AND you cannot locate a real extracted export elsewhere. Report "E2E steps skipped — no real export available"; do not generate synthetic data and pass it off as a real export.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- When any tab's section titles change, `smoke.mjs`'s `TAB_CHECKS` must change with them. That coupling is inherent to text-based E2E assertions; keep the list in one place rather than scattering selectors.
- A reviewer should check that no assertion was simply deleted to make the script pass. Each removed assertion must correspond to a component that no longer exists (this plan names both).
- Future work could add stable `data-testid` attributes to interactive components to decouple E2E from copy changes. Deliberately deferred — it is a wider change than this plan's S budget.
