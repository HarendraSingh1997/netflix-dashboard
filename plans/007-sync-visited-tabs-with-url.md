# Plan 007: Keep the mounted-tab set in sync with the URL

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4fc7036..HEAD -- src/App.tsx src/shell.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4fc7036`, 2026-09-23

## Why this matters

`src/App.tsx` only renders a tab's panel when that tab is in a `visited` set.
That set is seeded once from the initial route and afterwards updated **only**
by `selectTab` — the function the sidebar calls. Navigating by any other means
(browser Back/Forward, a pasted hash URL, an external link to
`#/viewing`, a bookmark) changes the route without touching `visited`, so the
active panel renders empty even though its data was already parsed. The user
sees a blank page under a populated sidebar. One `useEffect` closes the gap.

## Current state

- `src/shell.tsx:9-12` derives the active tab from the current pathname on
  every render:
  ```tsx
  export function Shell() {
    const { pathname } = useLocation()
    return <App tab={pathToTab(pathname)} />
  }
  ```
- `src/App.tsx:56-68` seeds and updates `visited`:
  ```tsx
  // Mount each panel on first visit, then keep it mounted: revisits are free,
  // but unvisited tabs cost nothing on initial load.
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set<TabId>([tab]))
  function selectTab(value: TabId) {
    setVisited((prev) => (prev.has(value) ? prev : new Set(prev).add(value)))
    setMenuOpen(false)
    ...
  }
  ```
- `src/App.tsx:170-189` gates every panel on that set, including the per-file
  route panel at 184-188.
- `src/App.tsx:73-79` already contains a `useEffect` in the same component
  (theme persistence), so the import of `useEffect` at line 1 needs no change.
- Convention (from `AGENTS.md`): React Compiler is on; do NOT add `useMemo`,
  `useCallback`, or `React.memo`. A `useEffect` is unaffected by that rule.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck + build | `npm run build` | `✓ built` |
| Lint | `npm run lint` | 0 errors (warnings allowed) |
| Unit tests | `npm test` | 49 tests pass |
| Manual repro | `npm run build && npm run preview` | see Step 3 |

## Scope

**In scope** (the only files you should modify):
- `src/App.tsx`

**Out of scope** (do NOT touch):
- `src/shell.tsx` — its behavior is correct; it already re-derives `tab` per render.
- `src/router.tsx` — the loader/preload logic is unrelated to mounting.
- `src/components/Sidebar.tsx` — it already calls `onNavigate` → `selectTab`.
- The `keepMounted` design itself: panels must still stay mounted after the first visit. Do not "fix" this by rendering only the active tab.

## Git workflow

- Branch: `advisor/007-visited-url-sync`
- Commit style: conventional commits, e.g.
  `fix: readable Profile → device Sankey on Viewing tab`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the sync effect

In `src/App.tsx`, directly after the `selectTab` function (currently ending at
line 68), add:

```tsx
// The route can change without selectTab (back/forward, pasted hash URL,
// external link). Track it so the panel for the active tab is mounted.
useEffect(() => {
  setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)))
}, [tab])
```

Keep the existing `selectTab` update in place. It is harmless to add the same
id twice, and removing it would make sidebar clicks depend on the effect firing
before first paint.

### Step 2: Verify the type surface is unchanged

`npm run build` must pass with no new errors. `TabId` is
`InsightTabId | FileTabId` (`src/App.tsx:44-45`), and `tab` is already typed
`TabId`, so `new Set(prev).add(tab)` typechecks as-is.

**Verify**: `npm run build` → `✓ built`.

### Step 3: Manually confirm the bug is gone

```sh
npm run build && npm run preview
```

In the browser: import an export, click **Viewing** in the sidebar, then press
the browser's Back button and Forward button. The panel must render content on
every stop — previously Back to an unvisited tab showed a blank area under a
populated sidebar. Also test a direct load of `<preview-origin>/#/devices` and
confirm the Devices tab renders.

If you have no real export available, report this step as unverified rather than
claiming it passed.

**Verify**: no blank panel on any Back/Forward step.

### Step 4: Run the gate

```sh
npm run lint && npm test
```

## Test plan

No new unit tests. This is a React component lifecycle concern and the repo has
no component-test harness (no `@testing-library/react`, no jsdom setup in
`vite.config.ts` — see `vite.config.ts:15-21`). Adding a DOM test environment
is a larger change than this bug warrants.

The regression proof is the manual check in Step 3, and it is additionally
covered end-to-end by `plans/006-restore-e2e-verification-scripts.md` once that
plan lands. Do not claim automated coverage that does not exist.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 (49 tests)
- [ ] `src/App.tsx` contains a `useEffect` whose dependency array is `[tab]`
- [ ] `grep -n "useMemo\|useCallback\|React.memo" src/App.tsx` returns no matches
- [ ] No files outside `src/App.tsx` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/App.tsx` no longer matches the "Current state" excerpts — in particular if the `visited` set or the `keepMounted` gating has been redesigned.
- Adding the effect causes a re-render loop (symptom: the browser tab hangs or the console fills with repeated renders). Report it; do not "fix" it by adding `useMemo`.
- `src/App.tsx` does not already import `useEffect` from `react` and the import line differs from `import { useEffect, useRef, useState } from 'react'` — report rather than guessing at the module's import style.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Any future navigation surface that changes the route without calling `selectTab` (keyboard shortcuts, a command palette, programmatic deep links) is now handled automatically, because the sync is driven by the route rather than by the caller.
- A reviewer should confirm the effect adds to the set and never removes from it — shrinking `visited` would unmount panels and defeat the deliberate keep-mounted design.
- Related, deliberately not in this plan: `selectTab` still closes the mobile drawer (`setMenuOpen(false)`) and that is only correct for sidebar-driven navigation. A back/forward navigation leaves the drawer state alone, which is the right behavior.
