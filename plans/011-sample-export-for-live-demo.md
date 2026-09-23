# Plan 011: Decide and prototype a sample export so the live demo is actually viewable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4fc7036..HEAD -- src/App.tsx src/lib/store.ts public/ README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `4fc7036`, 2026-09-23

## Why this matters

The repository was just made discoverable: a live preview URL sits at the top
of the README, `public/llms.txt` describes the app to AI crawlers,
`public/sitemap.xml` lists the deployed URL, and `index.html` carries Open Graph
and JSON-LD metadata. But the app is upload-only. Anyone who follows any of
those links — a person, a crawler, a citation — lands on an empty screen whose
only control is "Choose folder", with nothing to index, quote, or screenshot.
The project's own AI-reach goal is therefore blocked by its privacy model. This
plan scopes and prototypes the cheapest way to reconcile the two. **This is a
design/spike plan: it produces a decision and a working prototype, not a
polished feature.**

## Current state

- The deployed app is at `https://netflix-dashboard.pal-harendra95.workers.dev/#/` (from `README.md` and `index.html` canonical).
- `src/App.tsx:156-188` renders the landing state when `loaded` is false: a
  headline, a description, and a single folder input. There is no demo path.
- `src/App.tsx:80-88` is the only import entry point:
  ```tsx
  async function importFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    try { await loadFolder(files) }
    catch (e) { setError(e instanceof Error ? e.message : '…') }
  }
  ```
  which delegates to `loadFolder(files: FileList | File[])` — note the store
  signature already accepts a plain `File[]`, which a programmatic loader can
  synthesize.
- `src/lib/store.ts:114-135` `loadFolder` validates against `KNOWN` and queues
  parseable files. It needs `File` objects, not raw text; `src/lib/utils.ts:23-25`
  has `parseCsv(file: File)`.
- `src/lib/store.ts` already handles per-file statuses including
  `'document'` for PDFs (`store.ts:128`) and renders a "not parsed" message for
  them in `src/components/Explorer.tsx:14-21`. There is precedent for
  partially-supported inputs.
- A real export exists on the maintainer's machine at
  `/Users/harendrasingh/projects/Netflix/Netflix Member Information Request (HR)`
  and the scripts in `scripts/` reference it. **It is real personal data and
  must never be copied, sampled, or committed.**
- The privacy claim is load-bearing and copy-reviewed: `README.md` "Privacy"
  section, `index.html` description, `public/llms.txt`, and the footer all say
  local-only / never uploaded. Any demo path must not weaken those statements.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck + build | `npm run build` | `✓ built` |
| Lint | `npm run lint` | 0 errors |
| Unit tests | `npm test` | 49 tests pass |
| Manual | `npm run build && npm run preview` | prototype works at the landing screen |

## Scope

**In scope**:
- `src/App.tsx` — landing state and a demo entry point
- `src/lib/demo-data.ts` (create) — the synthetic fixture + loader
- `src/lib/demo-data.test.ts` (create, optional but recommended)
- `README.md` — only if the demo path is kept, to describe it accurately
- `public/llms.txt` — only if the demo path is kept, to mention it

**Out of scope** (do NOT touch, and never copy from):
- `/Users/harendrasingh/projects/Netflix/Netflix Member Information Request (HR)` — the real export. Read nothing from it. Generate synthetic rows from scratch.
- `src/lib/store.ts` — its `loadFolder(FileList | File[])` already accepts what a loader needs. If you find yourself editing it, STOP and report.
- The Privacy section wording in `README.md` — do not weaken or remove it.
- `vite.config.ts`, deployment config, `public/robots.txt`, `public/sitemap.xml`.

## Git workflow

- Branch: `advisor/011-demo-sample-data`
- Commit style: conventional commits, e.g. `feat: left sidebar with Sections + Files nav and per-file routes`.
- Do NOT push or open a PR unless the operator instructed it.

## The decision this plan must resolve

Three options, with the trade-off spelled out so the operator can choose:

- **A. Synthetic fixture in-repo (recommended here).** Generate a small CSV set
  (roughly 2,000–20,000 viewing rows across 3–4 profiles, 8–12 devices, 24
  months) with a seeded PRNG, commit it, and add a "Load sample data" button
  that fetches it at runtime and feeds the same `loadFolder` path. Pros: works
  offline, deterministic, screenshots and tests become reproducible, and the
  data is obviously fake. Cons: repo grows, and the fixture must be regenerated
  when column expectations change.
- **B. Static pre-rendered demo route.** A separate hash route that renders
  charts from a constant module with no store involvement. Pros: no fixture
  files, no parse cost, instant. Cons: a second rendering path that can drift
  from the real tabs — a maintenance liability the current single-code-path
  design deliberately avoids.
- **C. Do nothing.** Keep the upload-only privacy story pure. Pros: zero risk to
  the privacy claim. Cons: the deployed URL stays uncitable, and the AI-reach
  work just landed has nothing to point at.

Proceed with **A** unless the operator says otherwise. If the operator picks B
or C, record that in `plans/README.md` and mark this plan REJECTED with the
reason.

## Steps (option A)

### Step 1: Write the generator, not hand-written CSVs

Create `src/lib/demo-data.ts` exporting:

- `DEMO_FILES`: an array of `{ name, text }` where `name` is one of the real
  `KNOWN` filenames from `src/lib/store.ts:53-60` and `text` is CSV text.
- `buildDemoFiles(): Promise<{ name: string; file: File }[]>` which turns those
  into `File` objects via `new File([text], name, { type: 'text/csv' })`.

Generate the rows with a small deterministic PRNG (a mulberry32 or xorshift
implementation written inline — do not add a dependency). Seed it with a fixed
constant so every run produces identical output. Write the CSVs with a header
row using the exact column names the app reads, taken from the `Row` access
sites: `ViewingActivity.csv` needs `Start Time`, `Duration`, `Title`,
`Profile Name`, `Device Type` (see `src/tabs/Viewing.tsx:36-46`);
`Profiles.csv`, `Devices.csv`, `BillingHistory.csv`, `AccountDetails.csv`, and
`SearchHistory.csv` are the minimum to make Overview, Viewing, Discovery,
Profiles, Devices, and Billing render something. Timestamp format must satisfy
`parseTs` (`src/lib/utils.ts:55-61`) — mirror a real Netflix timestamp shape.

Keep total fixture size under roughly 1 MB. Do not generate all 25 files; a
handful that render well beats a complete but empty one.

**Verify**: `npm run build` → `✓ built`.

### Step 2: Test the generator without rendering React

Create `src/lib/demo-data.test.ts` following the colocated pattern in
`src/lib/files.test.ts` (plain `describe`/`it`/`expect`, no mocks): assert that
`DEMO_FILES` contains only names present in `KNOWN`, that every file's text
starts with a header line, that the viewing file has more than 1000 rows, and
that two calls to the generator produce byte-identical text (determinism).

**Verify**: `npm test` → 49 + N passing.

### Step 3: Add the landing-screen entry point

In `src/App.tsx`, add a secondary control inside the existing landing `<Card>`
(the one that currently holds the folder input, around lines 166-183), styled
as a quieter sibling of "Choose folder" — the repo's `Button` component has a
`variant="ghost"` already in use at `src/components/GraphFrame`/dialogs; match
an existing usage rather than inventing a style. The handler must reuse the
existing error handling:

```tsx
async function loadDemo() {
  setError('')
  try { await loadFolder(await buildDemoFiles()) }
  catch (e) { setError(e instanceof Error ? e.message : 'Could not load the sample data.') }
}
```

Guard against double-clicks with the existing pending state — `loadFolder`
already resolves only after `AccountDetails.csv` parses.

Label it "Load sample data" and add one caption line stating the data is
synthetic. Do **not** describe it in a way that implies it is a real export.

**Verify**: `npm run build` → `✓ built`; `npm run lint` → 0 errors.

### Step 4: Verify the whole surface, both themes

```sh
npm run build && npm run preview
```

Requirements:

- "Load sample data" populates the dashboard and lands on Overview.
- No `Empty` state appears on Overview, Viewing, Discovery, Profiles, Devices,
  or Billing.
- The Sankey (Viewing) renders with a bounded node count — note
  `viewingFlow` in `src/lib/analytics.ts:108-133` buckets all but the top 12
  devices into "Other devices", so keep the fixture at or under ~12 device
  names to exercise the interesting path.
- The heatmap (`src/components/Heatmap.tsx`) renders and scrolls.
- Both themes are legible on the sample data.
- No console errors.

### Step 5: Update the docs truthfully

If the demo path ships, add one line to the `README.md` "Run it" or "Get your
data" section and one bullet to `public/llms.txt` describing the sample data
as synthetic. Do not add a "no data uploaded" caveat that contradicts existing
copy; the sample fetch is same-origin static assets, which the existing privacy
wording already covers.

## Test plan

- `src/lib/demo-data.test.ts` (new): filename validity against `KNOWN`, header
  presence, row-count floor, and byte-for-byte determinism. Model the file
  structure on `src/lib/files.test.ts`.
- The UI button itself: no component-test harness exists in this repo (no
  `@testing-library/react`, no jsdom in `vite.config.ts`). Manual verification
  in Step 4 is the coverage; do not add a DOM test environment inside this plan.
- `npm test` must pass with the new file included.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] The operator's choice of option A/B/C is recorded in `plans/README.md`
- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0; `src/lib/demo-data.test.ts` exists (option A)
- [ ] `git ls-files | grep -i "Netflix Member Information Request"` returns nothing
- [ ] No file under `public/` exceeds 1 MB (`du -sh public/*`)
- [ ] The Privacy section of `README.md` is unmodified (`git diff README.md` shows no change to those lines)
- [ ] Manual sweep in Step 4 completed, or reported unverified with the reason
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any step requires reading, copying, sampling, or transforming data from the real export at `/Users/harendrasingh/projects/Netflix/Netflix Member Information Request (HR)`. This is a hard stop: the fixture must be generated from scratch. Generating rows by *observing* real values is also out of scope.
- `loadFolder` cannot accept synthesized `File` objects without editing `src/lib/store.ts`.
- The synthetic data cannot be made to render without weakening the Privacy wording in `README.md`, `index.html`, `public/llms.txt`, or the app footer.
- The generated fixture exceeds 1 MB, or the generator needs a new dependency.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The fixture will drift from the app's column expectations. Whichever tab breaks first after a schema change is the signal to regenerate — consider a `make demo` style npm script when that first happens rather than now.
- If the Ask tab is ever re-enabled, the demo data becomes its most valuable test input, because it is the one export available without personal data.
- Option B (a static pre-rendered route) was rejected here specifically because it creates a second rendering path that can drift from the tabs. If a reviewer prefers it, the drift cost is real and should be weighed against the smaller repo size.
