# Plan 005: Self-host fonts and make the privacy claim true

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

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (coordinate with plan 004 only in that both touch install state — either order works, do not run `npm install` concurrently)
- **Category**: security
- **Planned at**: no git repo; drift-check via excerpts. Date: 2026-09-18
- **Issue**: omit

## Why this matters

The app promises browser-only privacy ("Nothing is uploaded", "never leaves
this browser") yet every page load fetches stylesheets and font files from
Google's CDN, disclosing visitor IP, user-agent, and referrer to a third party
before any data is even imported. Self-hosting the three display faces removes
the only third-party egress and makes the claim true.

## Current state

- `index.html:12-17`:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@400&family=Cormorant+Garamond:wght@400&family=JetBrains+Mono:wght@400&display=swap"
    rel="stylesheet"
  />
  ```
  Families/weights in use: Saira Condensed 400, Cormorant Garamond 400,
  JetBrains Mono 400.
- `src/index.css` consumes them via `--font-display`, `--font-body`/`--font-sans`,
  `--font-mono` with system fallbacks already listed after each webfont.
- `package.json` already depends on `@fontsource-variable/inter` (precedent for
  the Fontsource pattern; Inter itself is not the face in use — do not remove it
  in this plan).
- Privacy wording: `README.md:3` ("Nothing is uploaded"), plus in-app copy
  stating files stay in memory / never leave the browser (grep
  `never leaves\|never leave\|stays in memory` under `src/` and `README.md` to
  find the exact lines at execution time).
- Conventions: keep the exact same family names, weight 400 only, `display=swap`
  behavior; no visual change is the acceptance bar.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0 |
| Typecheck | `npx tsc -b`             | exit 0 |
| Lint      | `npm run lint`           | 0 errors |
| Build     | `npm run build`          | `✓ built` |
| Egress check | `grep -rin "https://" index.html src/ \| grep -v "^Binary"` | only expected matches (see steps) |

## Scope

**In scope** (the only files you should modify):
- `index.html` (remove the three Google Fonts tags)
- `src/index.css` (Fontsource `@import`s for the three faces)
- `package.json` + `package-lock.json` (add `@fontsource/saira-condensed`, `@fontsource/cormorant-garamond`, `@fontsource/jetbrains-mono` — npm only, per plan 004's direction)
- `README.md` privacy wording (only if a line becomes inaccurate; see step 3)

**Out of scope** (do NOT touch, even though they look related):
- Font stacks, weights, or fallbacks beyond swapping the source of the same faces.
- `@fontsource-variable/inter` — leave it alone.
- Any response-header/CSP work (separate finding, needs a hosting layer).
- E2E scripts in `scripts/`.

## Git workflow

No git repo exists. Do not init one, commit, or push. Leave only in-scope files modified.

## Steps

### Step 1: Vendor the three faces via Fontsource

- Run `npm install @fontsource/saira-condensed @fontsource/cormorant-garamond @fontsource/jetbrains-mono` (weight-400 default entry points; do not add variable or multi-weight packages).
- In `src/index.css`, add matching `@import` lines for the 400 weight of each
  face, placed with the existing font import. Verify each package's documented
  CSS entry path inside `node_modules/@fontsource/<pkg>/` before writing the
  import (package layouts differ; do not guess).

**Verify**: `npx tsc -b` → exit 0. `npm run build` → `✓ built`, and the built CSS
in `dist/assets/*.css` contains the three family names (grep) — proving the
fonts bundle locally.

### Step 2: Remove the CDN tags

Delete the two `preconnect` links and the Google stylesheet link from
`index.html`. Do not touch the inline theme script, meta tags, or title.

**Verify**: `grep -rin "fonts.googleapis\|fonts.gstatic" index.html dist/index.html` →
no matches (rebuild first so `dist/` reflects the change). Full egress sweep:
`grep -rin "https://" index.html src/` → no third-party hosts remain (the only
acceptable matches would be none — report any you find).

### Step 3: Reconcile the privacy wording (only if needed)

Re-read `README.md:3` and the in-app copy found by grepping
`never leaves\|never leave\|stays in memory`. After steps 1–2 the claims are
true as written; change wording ONLY if a line promises something broader
(e.g. "zero network requests" — the app still has no backend calls, but do not
overclaim offline support unless verified). Prefer no doc change over a risky one.

**Verify**: `npm run lint` → 0 errors.

### Step 4: Visual regression check

**Verify**: `npm run build` → `✓ built`; then `node scripts/shots.mjs` → both
widths PASS (requires a real Netflix export folder at the hardcoded path in
`scripts/shots.mjs:6` — if absent, STOP here and report "visual check blocked:
no export"; do not invent screenshot comparisons). Open
`screenshots/landing-1440.png` and one tab shot and confirm the display/serif/
mono faces render (compare against the pre-change shots already committed under
`screenshots/`).

## Test plan

No new unit tests (font sourcing is build/packaging, verified by bundle grep +
screenshots). If `screenshots/` comparison shows any face falling back to
system fonts, treat as a failed gate, not a judgment call.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rin "fonts.googleapis\|fonts.gstatic" index.html` returns no matches
- [ ] Built CSS in `dist/assets/*.css` mentions Saira Condensed, Cormorant Garamond, and JetBrains Mono
- [ ] `npx tsc -b` exits 0; `npm run lint` → 0 errors; `npm run build` → `✓ built`
- [ ] Screenshot comparison shows no font fallback (or blocked-status reported for missing export)
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:
- A Fontsource package lacks a plain 400-weight CSS entry (layout differs) —
  report the actual layout instead of guessing paths.
- The egress sweep finds other third-party hosts you were not told about.
- Screenshots show fallback fonts and weight/style matching cannot be restored.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Dependabot-style updates to the three `@fontsource/*` packages are safe to
  take blind as long as the bundle grep in step 1 keeps passing.
- If a new face/weight is ever needed, it must come from Fontsource (or another
  vendored path) — re-adding a font CDN re-opens the finding this plan closes.
- Reviewer: diff `dist` bundle size before/after; three 400-weight woff2 files
  should add on the order of ~100KB total, not megabytes.
