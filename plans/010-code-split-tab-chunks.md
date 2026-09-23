# Plan 010: Code-split tab implementations out of the entry chunk

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4fc7036..HEAD -- src/App.tsx src/router.tsx src/main.tsx src/shell.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/009-defer-typesafe-sdk.md
- **Category**: perf
- **Planned at**: commit `4fc7036`, 2026-09-23

## Why this matters

The production build emits a single JavaScript chunk of 1,122,881 bytes raw
(343,668 bytes gzipped) and Vite prints its own warning that chunks exceed
500 kB. Every visitor downloads, parses, and evaluates all eleven tab
implementations plus the chart, map, grid, and matching libraries before they
can even choose a folder. The heaviest tabs — Viewing (Sankey + area + line
charts), Devices (geo map), Discovery (funnel) — are irrelevant to a visitor's
first ten seconds. Splitting them at the component boundary should cut the
entry chunk substantially and is the single highest-leverage performance change
available in this repo.

## Current state

- `src/main.tsx` is the entry:
  ```tsx
  import { StrictMode } from 'react'
  import { createRoot } from 'react-dom/client'
  import { RouterProvider } from '@tanstack/react-router'
  import './index.css'
  import { router } from './router.tsx'
  ```
- `src/router.tsx:7-10` imports tab metadata and the store:
  ```tsx
  import { TABS, type InsightTabId } from './App'
  import { useApp } from './lib/store'
  import { slugToFile } from './lib/files'
  import { NotFound, Root } from './shell'
  ```
  and defines loader-only routes at lines 35-42. **The router needs `TABS`
  (metadata) and `useApp` (for `ensureFile`) at module scope, but it does not
  need any tab component.** That separation is what makes this plan possible.
- `src/App.tsx:10-23` statically imports every tab and shared component:
  ```tsx
  import Overview from './tabs/Overview'
  import Viewing from './tabs/Viewing'
  import Discovery from './tabs/Discovery'
  import Ratings from './tabs/Ratings'
  import Profiles from './tabs/Profiles'
  import Devices from './tabs/Devices'
  import Billing from './tabs/Billing'
  import Messages from './tabs/Messages'
  import Games from './tabs/Games'
  import Account from './tabs/Account'
  import FileView from './tabs/FileView'
  import Explorer from './components/Explorer'
  import Sidebar from './components/Sidebar'
  ```
  and renders them at lines 170-189 with a hardcoded `TabsContent` per tab.
- `src/App.tsx:44-45` defines `InsightTabId`/`TabId`; `src/shell.tsx:5-12`
  imports `TABS` and `TabId` from `App`. **`TABS` and the id types living in
  `App.tsx` is the current coupling that forces the router to pull in every
  tab.** Moving the tab metadata into its own module is the first step.
- Panels use `keepMounted` and a `visited` set (`src/App.tsx:56-58`,
  `170-189`). Code splitting must not break the "visits are free afterwards"
  behavior that comment describes.
- Vite is 8 (Rolldown). The build warning suggests `build.rolldownOptions.output.codeSplitting`; **do not use that** — dynamic `import()` at the component boundary is the portable fix and needs no config change.
- Repository conventions: no `React.lazy`/`Suspense` precedent exists yet; the app currently has no loading boundary of its own (the skeleton logic lives per-tab via `TabSkeleton`). Alias `@` → `./src` is available but the existing files use relative paths — stay consistent with relative paths.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck + build | `npm run build` | `✓ built` |
| Lint | `npm run lint` | 0 errors (warnings allowed) |
| Unit tests | `npm test` | 49 tests pass |
| Bundle inspection | `npm run build && ls -la dist/assets/*.js` | multiple chunks, entry chunk visibly smaller than 1,122,881 bytes |
| Manual sweep | `npm run build && npm run preview` | every tab still renders and revisits are instant |

## Scope

**In scope**:
- `src/main.tsx`
- `src/router.tsx`
- `src/App.tsx`
- `src/shell.tsx`
- `src/tabs.ts` (create) — tab metadata only

**Out of scope** (do NOT touch):
- Any file under `src/tabs/` other than as a *default export target* — do not edit their internals.
- `src/lib/**` — the store, parser, and analytics must stay in the entry chunk; route loaders call `useApp.getState().ensureFile` synchronously (see `src/router.tsx:28-32, 47-55`) and moving them behind a dynamic boundary risks a preload race.
- `vite.config.ts` — no `manualChunks`, no `codeSplitting` tuning.
- The Ask tab (`src/App.tsx:182`, `src/router.tsx` `ask: []`) — it is intentionally disabled; leave it disabled.
- `src/components/Sidebar.tsx` — it must stay in the entry chunk because the sidebar renders on every loaded screen.
- Screenshots, docs, scripts.

## Git workflow

- Branch: `advisor/010-code-split-tabs`
- Commit style: conventional commits, e.g.
  `feat: left sidebar with Sections + Files nav and per-file routes`.
- Commit per step so the diff is reviewable in layers.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract tab metadata into `src/tabs.ts`

Create `src/tabs.ts` containing the icon imports, the `TABS` array, and the id
types — moved verbatim from `src/App.tsx:1-7` (the icon import) and
`src/App.tsx:26-45` (the `TABS` array plus `InsightTabId`/`TabId`):

```ts
import {
  Clapperboard, Compass, Database, Gamepad2, LayoutDashboard,
  MessageCircleQuestion, MessagesSquare, MonitorSmartphone, Receipt, Settings2,
  ThumbsUp, Users,
} from 'lucide-react'
import type { FileTabId } from './lib/files'

export const TABS = [ /* …unchanged… */ ] as const
export type InsightTabId = (typeof TABS)[number]['id']
export type TabId = InsightTabId | FileTabId
```

Note: the current `App.tsx` import line also carries `FolderOpen`, `Menu`,
`Moon`, `Sun`, and `Trash2`, which the tab metadata does not use — leave those
imported in `App.tsx` and import only the icon set the `TABS` entries need
above. `MessageCircleQuestion` is currently still imported by `App.tsx` even
though the Ask entry is commented out; keep it here only if the commented entry
is retained verbatim. Prefer removing the unused import.

Then update `src/router.tsx:7` and `src/shell.tsx:3` to import `TABS`/types
from `./tabs`, and delete those declarations from `App.tsx`, re-exporting from
`App.tsx` only if something else still imports them from there
(`src/router.tsx` and `src/shell.tsx` are the known importers).

**Verify**: `npm run build` → `✓ built`, and `grep -n "export const TABS" src/tabs.ts` → one match; `grep -n "export const TABS" src/App.tsx` → no matches.

### Step 2: Lazily import the heavy tab components

In `src/App.tsx`, replace the static tab imports with lazy ones. Use React's
`lazy` plus a `Suspense` boundary around the tab panels:

```tsx
import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const Overview = lazy(() => import('./tabs/Overview'))
const Viewing = lazy(() => import('./tabs/Viewing'))
const Discovery = lazy(() => import('./tabs/Discovery'))
const Ratings = lazy(() => import('./tabs/Ratings'))
const Profiles = lazy(() => import('./tabs/Profiles'))
const Devices = lazy(() => import('./tabs/Devices'))
const Billing = lazy(() => import('./tabs/Billing'))
const Messages = lazy(() => import('./tabs/Messages'))
const Games = lazy(() => import('./tabs/Games'))
const Account = lazy(() => import('./tabs/Account'))
const Explorer = lazy(() => import('./components/Explorer'))
const FileView = lazy(() => import('./tabs/FileView'))
```

Each of those modules has a `export default function …` — confirm before
converting, and if any uses a named default re-export, adapt the arrow.

Keep `Sidebar`, `ui/*`, and the `Card`/`Button`/`Alert` shell imports static:
they render immediately after import and are small.

### Step 3: Add the Suspense boundary

Wrap the `<Tabs>` block in `src/App.tsx:171-189` with a `Suspense` boundary
whose fallback matches the existing loading language. The repo already has a
skeleton component — `TabSkeleton` in `src/components/ui.tsx` — exported for
tab use; the landing-state branch and `Empty` are also there. Use a
`TabSkeleton` with the same props shape the tabs pass at their own pending
branches (e.g. `charts={4} cards={3} columns={3} table`) as the fallback for
the boundary, so a chunk load does not collapse the layout:

```tsx
<Suspense fallback={<TabSkeleton charts={4} cards={3} columns={3} table />}>
  <Tabs value={tab}> … unchanged … </Tabs>
</Suspense>
```

If `TabSkeleton` turns out not to be exported from `src/components/ui.tsx`,
STOP and report rather than inventing a new skeleton.

**Verify**: `npm run build` → `✓ built`; `grep -n "Suspense" src/App.tsx` → at least one match.

### Step 4: Measure the result

```sh
npm run build
ls -la dist/assets/*.js
```

Expected: several `.js` chunks instead of one, and the entry chunk
(`index-*.js`) materially smaller than its current 1,122,881 bytes. Record the
before/after numbers in your final report — the before number is 1,122,881 bytes
raw / 343,668 bytes gzipped.

If the entry chunk barely moved, report that honestly with the numbers rather
than claiming success; the likely cause is a shared import (check
`src/components/TimeChart.tsx` and `src/components/ChartFrame.tsx`, which pull
Recharts into every chunk that uses them).

**Verify**: chunk count ≥ 2 and entry chunk size recorded.

### Step 5: Run the gate and do a full manual sweep

```sh
npm run lint && npm test && npm run build
npm run build && npm run preview
```

With a real export imported, click through **all eleven tabs** in the sidebar,
then revisit three of them. Requirements:

- No tab renders blank; each shows its content once its chunk arrives.
- Revisiting an already-visited tab is still instant (the `visited` set plus
  `keepMounted` must continue to work; a chunk should not re-fetch).
- A per-file page from the sidebar's **Files** section still renders
  (`FileView`, now lazy).
- No console errors.
- The disabled Ask tab is still absent from the sidebar.

If no real export is available, run the sweep as far as the import screen and
report the rest as unverified.

## Test plan

No new unit tests: this plan changes how modules are loaded, not what they
compute. `npm test` must stay at 49 passing.

If you want a regression guard against re-merging everything into one chunk,
the cheapest honest one is the Step 4 measurement recorded in the final report
plus the `ls dist/assets/*.js` count — not a test. Do not add a bundle-size
assertion to the unit suite; it would make `npm test` depend on a production
build, which this repo deliberately keeps separate.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 (49 tests)
- [ ] `ls dist/assets/*.js` lists 2 or more chunks
- [ ] Entry chunk raw size is smaller than 1,122,881 bytes (record the number)
- [ ] `grep -rn "lazy(() => import" src/App.tsx` returns 12 matches (11 tabs + `FileView`)
- [ ] `grep -n "useMemo\|useCallback\|React.memo" src/App.tsx` returns no matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `vite.config.ts` appears to require changes to produce a split — do not edit it; report what was needed.
- A tab module does not have a default export, so the lazy arrow cannot be built without modifying that tab. Report which module; do not edit the tab.
- Moving `TABS` into `src/tabs.ts` produces a circular import (for example `src/tabs.ts` → `src/lib/files.ts` → … → `src/App.tsx`). Report the cycle; do not resolve it by re-exporting from `App.tsx`.
- The manual sweep shows a blank tab, a broken revisit, or any console error that traces to this change. Report which tab and the error; do not paper over it by removing `keepMounted`.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Every future tab added to `TABS` needs a matching `lazy(...)` line and a `TabsContent` entry. Those two lists now live apart from each other; keep them adjacent in the file so a future addition cannot miss one.
- This plan splits by *tab*. The next meaningful split would be by *chart type* (Recharts is the dominant weight) if a single tab's chunk is still large after this lands. That is a separate change, not a follow-up inside this plan.
- Interaction with `plans/009-defer-typesafe-sdk.md`: run 009 first. After this plan, the SDK's own chunk may be merged into whichever chunk imports `jev.ts` (the Discovery path); verify the Step 2 grep in 009 still passes after 010 lands.
- A reviewer should check that the entry chunk still contains `src/lib/store.ts` and Papa Parse, because the route loaders at `src/router.tsx:28-32` depend on them being available synchronously.
