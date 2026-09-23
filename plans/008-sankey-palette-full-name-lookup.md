# Plan 008: Look up Sankey profile colors by full name, not the truncated label

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4fc7036..HEAD -- src/tabs/Viewing.tsx src/lib/profiles.ts src/lib/profiles.test.ts`
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

The Profile → device Sankey colors a profile's node and its outgoing links with
the shared palette rule. The node renderer looks that color up using the
**display label** (truncated to 26 characters, with anything before a `:` in the
profile name stripped), while the link renderer uses the **raw profile name**.
`profileColorVar` matches by exact string equality, so any profile whose name
is longer than 26 characters or contains a colon falls through to the muted
"other" color for its node while its links keep the ranked color. The chart then
shows one profile in two different colors, which defeats the encoding. This is a
regression introduced when the Sankey was ported in from the reference project
(`git show d2183b0`).

## Current state

- `src/lib/profiles.ts:19-21` — the lookup is an exact match:
  ```ts
  export function profileColorVar(name: string, ranked: string[]): string {
    const index = ranked.indexOf(name)
    return index >= 0 && index < PROFILE_VARS.length ? `var(${PROFILE_VARS[index]})` : `var(${PROFILE_OTHER_VAR})`
  }
  ```
- `src/tabs/Viewing.tsx:55-85` — node and link renderers disagree:
  ```tsx
  const rankedProfiles = topN(filtered, (s) => s.profile).map((r) => r.name)
  const shortName = (name: string) => {
    const bare = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name
    return bare.length > 26 ? `${bare.slice(0, 25)}…` : bare
  }
  const sankeyNode = (props: any) => {
    const { x, y, width, height, payload } = props
    const name: string = payload.name ?? ''
    const isProfile = name.startsWith('Profile:')
    const bare = shortName(name)
    const fill = isProfile ? profileColorVar(bare, rankedProfiles) : 'var(--color-faint)'
    ...
    <text ...>{bare}</text>
  ```
  Note `name` is the node key built by `viewingFlow` in
  `src/lib/analytics.ts:119-122` as `` `${stage}:${value || 'Unknown'}` ``, so a
  profile node's `payload.name` is the string `Profile:<raw profile name>`.
  The link renderer at lines 76-85 instead slices the prefix off:
  ```tsx
  const sourceName: string = payload.source.name ?? ''
  const bare = sourceName.startsWith('Profile:') ? sourceName.slice('Profile:'.length) : shortName(sourceName)
  ```
  It still applies `shortName` to the device branch, which is correct.
- `src/lib/profiles.test.ts` is the existing test file for this rule; it
  currently covers ranks 1-4, rank 5, and unknown names, but no long or
  colon-containing names.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck + build | `npm run build` | `✓ built` |
| Lint | `npm run lint` | 0 errors (warnings allowed) |
| Unit tests | `npm test` | 49 tests pass (53 after this plan) |
| Visual check | `npm run build && npm run preview` | Sankey node and its links share a color |

## Scope

**In scope** (the only files you should modify):
- `src/tabs/Viewing.tsx`
- `src/lib/profiles.test.ts`

**Out of scope** (do NOT touch):
- `src/lib/profiles.ts` — the exact-match rule is correct; the bug is the wrong argument at the call site. Do not loosen the matcher to a prefix/substring match, which would make it ambiguous.
- `src/lib/analytics.ts` — `viewingFlow`'s `Profile:<name>` key format is the contract both renderers already rely on.
- `src/index.css` — the `--profile-1..4` tokens and their dark-theme ramp were fixed in commit `4e71a5e`; do not re-tune colors.
- Other charts. The same truncation does not affect them because they pass raw names to `profileColorVar`.

## Git workflow

- Branch: `advisor/008-sankey-palette-lookup`
- Commit style: conventional commits, e.g. `fix: readable Profile → device Sankey on Viewing tab`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Strip only the stage prefix, keep the full profile name

In `src/tabs/Viewing.tsx`, inside `sankeyNode`, replace the two lines:

```tsx
    const bare = shortName(name)
    const fill = isProfile ? profileColorVar(bare, rankedProfiles) : 'var(--color-faint)'
```

with:

```tsx
    const bare = shortName(name)
    const colorKey = isProfile ? name.slice('Profile:'.length) : name
    const fill = isProfile ? profileColorVar(colorKey, rankedProfiles) : 'var(--color-faint)'
```

`colorKey` keeps the full raw profile name for the lookup; `bare` is still what
gets rendered as the label, so truncation and colon-stripping behavior in the UI
is unchanged.

**Verify**: `npm run build` → `✓ built`.

### Step 2: Make the link renderer equally explicit

Inside `sankeyLink`, replace:

```tsx
    const bare = sourceName.startsWith('Profile:') ? sourceName.slice('Profile:'.length) : shortName(sourceName)
```

with:

```tsx
    const colorKey = sourceName.startsWith('Profile:') ? sourceName.slice('Profile:'.length) : sourceName
```

and use `colorKey` in the `stroke` call instead of `bare`:
`stroke={profileColorVar(colorKey, rankedProfiles)}`. The device branch of
`sankeyLink` is only reached for a malformed graph (a link source is always a
profile node), so using the untruncated name there is harmless and removes the
last asymmetric truncation.

**Verify**: `npm run build` → `✓ built`.

### Step 3: Add the regression tests

In `src/lib/profiles.test.ts`, add a new `it` inside the existing
`describe('profileColorVar', ...)` block. Follow the file's existing style
(plain `expect(...).toBe(...)`, no mocks, no new imports):

```ts
it('matches long and colon-containing profile names exactly', () => {
  const long = 'Everyone: The Main Family Entertainment Collection'
  const named = ['Harry', 'KB', long]
  expect(profileColorVar(long, named)).toBe('var(--profile-3)')
  expect(profileColorVar('Harry: Kid', ['Harry: Kid'])).toBe('var(--profile-1)')
})
```

The second assertion documents the intended contract: the raw name is the key,
so `Harry: Kid` matches itself and is never confused with a different `Harry`
entry.

**Verify**: `npm test` → `53 passed`.

### Step 4: Run the gate

```sh
npm run lint && npm test && npm run build
```

### Step 5: Visually confirm on a real export

```sh
npm run build && npm run preview
```

Import a real export, open **Viewing**, and scroll to the Profile → device
Sankey. If any profile name in your export exceeds 26 characters or contains a
colon, that profile's left-hand node and its outgoing links must now render in
the same color. If no such profile exists in the export, report the step as
"no qualifying profile in the available export" — do not fabricate one.

## Test plan

- New tests in `src/lib/profiles.test.ts` (the file that already owns this
  rule's coverage): a profile name longer than the 26-char truncation point, and
  a profile name containing a colon.
- Structural pattern: copy the assertion style of the existing
  `it('sends rank five and unknown names to the muted slot')` case in the same file.
- `npm test` → all pass, 49 → 53.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run build` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0; `src/lib/profiles.test.ts` has the new long/colon cases
- [ ] `grep -n "profileColorVar(bare" src/tabs/Viewing.tsx` returns no matches
- [ ] `grep -n "profileColorVar" src/tabs/Viewing.tsx` shows 2 call sites, both passing a non-truncated name
- [ ] `src/lib/profiles.ts` is unmodified (`git status`)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/analytics.ts` no longer prefixes profile node names with `Profile:` — the slicing at `'Profile:'.length` would then be wrong and the node key format must be re-derived first.
- `src/lib/profiles.ts` no longer does an exact `ranked.indexOf(name)` match — the fix premise has changed.
- The label text in the Sankey changes as a result of Step 1 (truncation or colon-stripping should be visually unchanged; only the color lookup changes). Investigate and report rather than adjusting the label to compensate.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The root cause is a display concern (`shortName`) leaking into a data concern (color identity). If a second chart ever renders a truncated label through `profileColorVar`, fix the same way: keep display formatting and lookup keys separate.
- A reviewer should check that `shortName` is still applied to the rendered `<text>` content, and only to it.
- Related, deliberately out of scope: `shortName` strips everything before the first `:`, which mangles a profile genuinely named `Family: Kids` into `Kids`. That is a labeling choice, not a correctness bug, and changing it would alter the UI this plan is meant to leave alone.
