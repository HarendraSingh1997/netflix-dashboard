# AGENTS.md — Netflix Insights

This file guides coding agents working in this repo. Humans: `README.md` is the user-facing doc; this is the contributor/operator contract.

## Stack map

- React 19 + TypeScript + Vite (`src/main.tsx`, `src/App.tsx`, `src/router.tsx`, `src/shell.tsx`)
- Tailwind CSS v4 (`src/index.css` theme tokens, `--profile-1..4` palette)
- TanStack Router with hash history; URL-synced tabs; route loaders pre-parse per-tab CSVs (`src/router.tsx:13-26`)
- Zustand in-memory store (`src/lib/store.ts`): `loaded`, `loadFolder(files)`, `ensureFile(name)`, `reset()`
- Papa Parse for CSV; lodash-es utilities; Recharts; TanStack Table + TanStack Virtual
- shadcn / Base UI primitives in `src/components/ui/` (Button, Card, Dialog, Tabs, Table, Badge, Input, Select, Alert, Label, Separator, Tooltip)
- TypeSafe JS SDK (`@typesafe-ai/sdk`, `src/lib/jev.ts`, `src/lib/ask/`) — opt-in only

## Conventions

- React Compiler is on (`vite.config.ts`): auto-memoization. Do NOT add manual `useMemo` / `useCallback` / `memo`.
- 12 tabs defined in `src/App.tsx:26-39`. Adding a tab means: `TABS` entry + `src/tabs/X.tsx` + `TAB_FILES` entry in `src/router.tsx` + keep-mounted `TabsContent` in `App.tsx`.
- Every tab: KPI cards + insights card + monthly time chart. Tables: full card width, every source column, sortable/searchable/virtualized with faceted filter chips, no pagination.
- Charts live in `src/components/TimeChart.tsx` / `ChartFrame.tsx` (icon-only fullscreen). Geo map in `src/components/GeoMap.tsx`.
- Skeleton loaders must mirror the tab layout (no layout shift, no "no data" flash).
- Dark theme default (`<html class="dark">` in `index.html`); light toggle persists `localStorage.theme`. Use theme tokens, never hardcoded colors for charts/tables/maps.
- Path alias `@` → `./src` (`vite.config.ts`, `tsconfig.app.json`).
- npm only. `package-lock.json` is the single lockfile. Never reintroduce `pnpm-lock.yaml`.

## Commands

```sh
npm install
npm run dev
npm run build    # tsc -b + vite build
npm run lint     # oxlint
npm test         # vitest run
npm run preview
node scripts/smoke.mjs         # needs dist/ + real export
node scripts/verify-charts.mjs
node scripts/verify-chips.mjs
node scripts/shots.mjs
```

## Guardrails

- NEVER commit `.env`, real Netflix exports/CSVs, or API keys. `.env.example` documents `VITE_TYPESAFE_API_KEY`. Verify with `git status --short` and `git check-ignore -v .env` before committing.
- AI features are opt-in: only title/question strings may leave the browser, via the `/typesafe-api` proxy. No export rows, no PII beyond what the user typed.
- Do not commit `dist/`, `node_modules/`, `test-results/`.
- Keep `README.md` screenshots in sync when changing tab layouts (`screenshots/`, `scripts/shots.mjs`).
- Plans live in `plans/`; update `plans/README.md` status rows when executing a plan.

## Skills

See `SKILLS.md` for the installed skill index (`.agents/skills/*`, `skills-lock.json`).
