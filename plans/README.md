# Implementation Plans

Two advisor runs. Plans 001–005 were generated 2026-09-18 (all DONE). Plans
006–011 were generated 2026-09-23 from a performance-and-correctness audit of the
post-launch repo (recon + 2 parallel category audits, every finding vetted against
the live code by the advisor). Execute in the order below unless dependencies say
otherwise. Each executor: read the plan fully before starting, honor its STOP
conditions, and update your row when done.

Repo notes every executor needs: the repo is now a git repository (plans 001–005
predate that — their "no git repo exists" notes are stale, ignore them). Canonical
package manager is **npm**; `package-lock.json` is the single lockfile and
`pnpm-lock.yaml` is gitignored — never reintroduce it. If `node`/`npm` are not on
PATH, prefix commands with
`export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"`. E2E scripts
(`scripts/*.mjs`) require a built `dist/` **and** a real extracted Netflix export
folder; without one, unit/build/lint gates are the bar and E2E steps are reported
skipped, never faked. A real export contains PII and must never be committed.

Hard convention from `AGENTS.md` that overrides most "obvious" optimizations:
React Compiler is on, so **never** add `useMemo`, `useCallback`, or `React.memo`.
Plans that improve render performance must instead move computation to the data
layer or use dynamic `import()`.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Honor the `topN` limit and establish the unit-test harness | P1 | S | — | DONE |
| 002 | Report true watch-hours on the Overview tab | P1 | S | 001 | DONE |
| 003 | Rank Devices regions once from combined counts | P2 | S | 001 | DONE |
| 004 | Standardize on npm as the single package manager | P1 | S | — | DONE |
| 005 | Self-host fonts and make the privacy claim true | P1 | S | — | DONE |
| 006 | Restore the E2E verification scripts so they exercise the current UI | P1 | S | — | TODO |
| 007 | Keep the mounted-tab set in sync with the URL | P1 | S | — | TODO |
| 008 | Look up Sankey profile colors by full name, not the truncated label | P1 | S | — | TODO |
| 009 | Load the TypeSafe SDK on first title match, not on page load | P1 | S | — | TODO |
| 010 | Code-split tab implementations out of the entry chunk | P1 | L | 009 | TODO |
| 011 | Decide and prototype a sample export so the live demo is viewable | P2 | M | — | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED (with one-line rationale)

## Dependency notes

- **006 gates 007–010.** Every later plan's verification story leans on
  `scripts/smoke.mjs` and `scripts/verify-charts.mjs`, and those currently fail
  against the current UI (they query the removed day/hour heatmap). Run 006 first
  so the others can be checked against a real export.
- **009 before 010.** Both change what ends up in which chunk. Doing the SDK
  deferral first means the code-split plan measures a cleaner before/after and
  its bundle greps stay meaningful.
- 007 and 008 are independent one-liners and can run in either order or in
  parallel with each other. They touch disjoint files (`src/App.tsx` vs
  `src/tabs/Viewing.tsx`).
- 011 is independent but is a **decision plan**: the operator must choose
  option A, B, or C before an executor starts.
- 004 and 005 (both DONE) ran `npm install`; do not run them concurrently with
  anything else that installs.

## Findings considered and rejected (not planned)

From the 2026-09-23 audit — recorded so they are not re-audited:

- **Replace the four lodash-es aggregation helpers with hand-rolled Map/reduce
  (~50 KB raw).** Rejected: a bad trade. It is 4.5% of the current chunk, and
  native replacements risk changing tie-breaking, blank-key, and numeric
  conversion behavior in the analytics layer. Revisit only if the entry chunk
  becomes the dominant load after 010.
- **A shared derived-data layer (per-file summaries computed once at parse
  time and shared across tabs).** Rejected for now: L effort, MED review risk,
  and the React Compiler already caches component-local derivations. The
  findings it subsumes (Heatmap re-sorting on scroll, DataGrid row model,
  GeoMap bucket identity) are cheaper to fix individually if profiling ever shows
  they matter.
- **Move CSV parsing to a Web Worker and intent-gate hover preloads.** Valid and
  the highest-value *unplanned* perf item — a 126k-row parse blocks the main
  thread and `Promise.all` over `TAB_FILES` does not parallelize synchronous JS.
  Deferred because it is M effort with MED regression risk and needs large-file
  coverage that does not exist yet. Revisit after 006 lands the E2E harness.
- **Font subset trimming (25 files / 388 KB).** Rejected: `unicode-range`
  already means the browser fetches only matching subsets, so this is deployment
  payload, not user transfer. Not worth the risk of dropping glyphs for
  international Netflix titles.
- **Surface parse failures distinctly from empty exports.** Real (a corrupt file
  looks like an empty one: `store.ts:146-148` sets `error`, `usePending:173`
  counts it settled, tabs render "No … found"). M effort, MED risk because it
  changes loading/empty transitions in all 11 tabs. Deferred as a follow-up to
  006, which is the harness needed to verify it.
- **Reject non-ASCII titles in `normalizeTitle` (`title-match.ts:24-30`) and the
  `month`/`Other` series-key collision (`analytics.ts:96`).** Real but
  edge-case; both are cosmetic at the scale of a personal export. Add to the
  backlog, do not plan.
- **`topN` used to pick the "most recently accepted" Terms date
  (`Account.tsx:21`).** Real one-line bug (it picks most *frequent*). Cheap, but
  not planned here because 006–010 are higher leverage. Fix opportunistically.
- **CSP / response-hardening headers.** Still needs a real hosting layer; the
  app is served from a Cloudflare Worker with no config in this repo.

## Still open from the 2026-09-18 run (deferred, not planned)

- Tab-scaffold consolidation (pending-guard/KPI rhythm ×10) — M effort, MED
  review risk; worth doing once churn resumes.
- Virtualizer dynamic measurement — MED fix-risk; current estimate holds.
- Utils module split, `shadcn` dev-dep recategorization, portable Playwright
  scripts, per-tab contract checks, mobile 390px overlap, CSV export,
  shareable filter URLs — all valid backlog, none blocking.
