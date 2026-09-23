# Plan 009: Load the TypeSafe SDK on first title match, not on page load

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4fc7036..HEAD -- src/lib/jev.ts src/lib/store.ts src/components/TitleMatch.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `4fc7036`, 2026-09-23

## Why this matters

The app's headline privacy claim is that nothing leaves the browser unless the
user explicitly opts in, and the AI feature is opt-in by design. But the
TypeSafe SDK is currently downloaded, parsed, and held in memory by **every
visitor on first paint**, including the large majority who will never click
"Match titles". It reaches the entry chunk through a chain of static imports
that nobody can see from the UI: the store imports the judgment function, and
the store is imported by the router, which is imported by the entry point. The
remedy is small: move the SDK import behind the first call that needs it.

## Current state

The full import chain, all static, no dynamic boundary:

- `src/main.tsx:5` — `import { router } from './router.tsx'`
- `src/router.tsx:7-8` — `import { TABS, type InsightTabId } from './App'` and
  `import { useApp } from './lib/store'`
- `src/App.tsx:9` — `import { useApp } from './lib/store'`
- `src/lib/store.ts:4` — `import { judgeTitlePair, MAX_PAIRS } from './jev.ts'`
- `src/lib/jev.ts:12` — `import { TypeSafeClient, noul, score } from '@typesafe-ai/sdk'`

`src/lib/jev.ts` also builds its `QUESTIONS` constant at module scope:

```ts
const QUESTIONS = {
  link: score('How do the two title strings relate as Netflix shows?', [...LEVELS]),
  same_base: noul('Do both titles name the same base show, ignoring season, episode, year, or edition differences?'),
  same_scope: noul('Do both titles refer to the same scope — the same show and installment, not different seasons, episodes, or editions?'),
}
```

`score()` and `noul()` are SDK calls, so that object is another reason the
module cannot be trivially emptied. The single network call site is
`src/lib/jev.ts:45-68`:

```ts
export async function judgeTitlePair(apiKey: string, a: string, b: string): Promise<PairJudgment> {
  const client = new TypeSafeClient({ apiKey, baseURL: '/typesafe-api', dangerouslyAllowBrowser: true })
  const response = await client.systemOne({ state: { title_a: a, title_b: b }, questions: QUESTIONS, model: JEV_MODEL }, { timeout: 45000 })
  ...
}
```

The only caller is the store's `runTitleMatch` action, at
`src/lib/store.ts:91`: `const judgment = await judgeTitlePair(apiKey, pair.a, pair.b)`.
That action is user-initiated from `src/components/TitleMatch.tsx` and is
guarded by a `generation` check at `store.ts:89` and `:92` to cancel on
re-import or reset. There is no other caller, and no module-level SDK usage
outside `judgeTitlePair`.

Repo conventions that apply: npm only; TypeScript strict; no manual
`useMemo`/`useCallback`/`React.memo` (not relevant here — this is not a
component). ESM extension style: relative imports carry the extension only when
targeting `.ts`/`.tsx` module files (`'./jev.ts'`, `'./store.ts'`), plain
relative imports for `./components/*` and `./tabs/*`. Match whatever the file
already does.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck + build | `npm run build` | `✓ built` |
| Lint | `npm run lint` | 0 errors (warnings allowed) |
| Unit tests | `npm test` | 49 tests pass |
| Bundle check | `npm run build && ls dist/assets/*.js` | more than one `.js` file in `dist/assets` |

## Scope

**In scope** (the only files you should modify):
- `src/lib/jev.ts`

**Out of scope** (do NOT touch):
- `src/lib/store.ts` — the call site at line 91 is already async and already passes through the `generation` guard. Changing it is not required to achieve the deferral.
- `package.json` / `package-lock.json` — the SDK stays a dependency; it is just no longer eagerly bundled.
- `src/tabs/Ask.tsx` and `src/lib/ask/*` — the Ask tab is intentionally disabled (`src/App.tsx:182`) and already absent from the bundle. Do not re-enable it.
- `.env`, `.env.example` — the key contract is unchanged.
- `vite.config.ts` — do not add manual chunk configuration; a dynamic import is enough and more robust.

## Git workflow

- Branch: `advisor/009-defer-typesafe-sdk`
- Commit style: conventional commits, e.g.
  `fix: readable Profile → device Sankey on Viewing tab`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Move the SDK import and `QUESTIONS` inside `judgeTitlePair`

In `src/lib/jev.ts`, remove the top-level import at line 12:

```ts
import { TypeSafeClient, noul, score } from '@typesafe-ai/sdk'
```

Remove the module-scope `QUESTIONS` constant (lines 26-30) as well, and move
its definition — together with the `import` — to the top of the
`judgeTitlePair` function body, so both are evaluated on first call:

```ts
export async function judgeTitlePair(apiKey: string, a: string, b: string): Promise<PairJudgment> {
  const { TypeSafeClient, noul, score } = await import('@typesafe-ai/sdk')
  const questions = {
    link: score('How do the two title strings relate as Netflix shows?', [...LEVELS]),
    same_base: noul('Do both titles name the same base show, ignoring season, episode, year, or edition differences?'),
    same_scope: noul('Do both titles refer to the same scope — the same show and installment, not different seasons, episodes, or editions?'),
  }
  // ...existing body, with `QUESTIONS` renamed to `questions`
}
```

Keep the `LEVELS` and `OUTCOMES` module-scope constants exactly as they are —
they are plain data and are needed by `routeOutcome` at line 41.

**Verify**: `npm run build` → `✓ built`.

### Step 2: Verify the SDK is no longer in the entry chunk

```sh
npm run build
ls dist/assets/*.js
```

At least two `.js` files must now exist: the entry chunk and a lazily-loaded
chunk containing the SDK. Then confirm the split by searching the entry chunk
for a distinctive SDK string, e.g. the `TypeSafeClient` identifier or
`dangerouslyAllowBrowser` (present at `src/lib/jev.ts:50`):

```sh
grep -c "dangerouslyAllowBrowser" dist/assets/index-*.js
```

Expected: `0` in the entry chunk, non-zero in the lazily-loaded chunk. If the
entry chunk still contains it, the import did not become dynamic — return to
Step 1 and check that no other module statically imports `@typesafe-ai/sdk`
(`grep -rn "@typesafe-ai/sdk" src/` should return only the one dynamic import).

### Step 3: Run the gate

```sh
npm run lint && npm test && npm run build
```

### Step 4: Confirm the feature still works end to end

```sh
npm run build && npm run preview
```

Import a real export, open **Discovery**, and run title matching with a real
`VITE_TYPESAFE_API_KEY`. The candidate pairs must still be judged and merged
identically to before; a first call now pays a one-time module fetch before
the first request. If no API key is available, report this step as unverified —
do not claim it passed.

## Test plan

No new unit tests are required: `judgeTitlePair` is a thin network wrapper with
no pure logic to test, and the repo's existing suite deliberately does not mock
the SDK. The regression this plan risks is "the AI feature stopped working",
which the Step 4 manual check covers and which `scripts/verify-charts.mjs` does
not exercise.

Explicitly do NOT add a test that imports `@typesafe-ai/sdk` at the top of a
test file and asserts the bundle size — that reintroduces the very coupling
this plan removes.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0 (49 tests)
- [ ] `ls dist/assets/*.js` lists 2 or more files
- [ ] `grep -rn "@typesafe-ai/sdk" src/` returns exactly one match, and it contains `await import(`
- [ ] `grep -c "dangerouslyAllowBrowser" dist/assets/index-*.js` → `0`
- [ ] No files outside `src/lib/jev.ts` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `grep -rn "@typesafe-ai/sdk" src/` returns more than one module — a second static importer means the deferral will not work and the second site must be reported.
- `src/lib/store.ts` is not the only caller of `judgeTitlePair` — another caller at module scope would reintroduce eager loading.
- `npm run build` succeeds but the entry chunk still contains the SDK string (Step 2 fails twice). Do not work around it with a `manualChunks` hack in `vite.config.ts`; report instead.
- The AI feature breaks at runtime for a reason traced to this change rather than to a missing/invalid API key. Report the actual error; do not weaken the generation-cancellation logic in `store.ts` to make it "work".
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- When the Ask tab is re-enabled (see `src/App.tsx:182` and `src/router.tsx`'s commented `ask: []` entry), it will pull `@typesafe-ai/sdk` through `src/lib/ask/*`. Re-check the entry-chunk grep in Step 2 after that re-enable; the ask engine will be large and will dominate any future code-splitting plan.
- A reviewer should confirm `store.ts` is untouched — the cancellation semantics there are load-bearing and the deferral must not weaken them.
- The first title-match click now has a small extra latency (one module fetch). If that becomes noticeable, prefetch the module on hover of the "Match titles" control rather than on page load; do not move it back to a static import.
