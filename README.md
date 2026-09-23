# Netflix Insights

A private, browser-only analytics dashboard for your Netflix "Member Information Request" data export.

Select the extracted export folder and explore viewing, discovery, ratings, profiles, devices, billing, messages, games, and account data. Everything is parsed locally with Papa Parse. Nothing is uploaded, and clearing the dashboard (or reloading) wipes imported data from memory.

![Overview dark](screenshots/overview-1440.png)
![Viewing](screenshots/viewing-1440.png)
![Devices map](screenshots/devices-map-1440.png)

Light theme (persisted header toggle, same tokens):

![Overview light](screenshots/overview-light-1440.png)
![Viewing light](screenshots/viewing-light-1440.png)
![Landing light](screenshots/landing-light-1440.png)

## Privacy

- 100% local: CSV files are read with the File System Access / `<input webkitdirectory>` APIs and parsed in browser memory (Zustand store).
- No backend, no telemetry, no cookies. The app never sends your export anywhere.
- Exception (opt-in only): AI features described below send only title/question strings to the TypeSafe API. They are off unless you provide your own key.
- Reloading the page or clicking **Clear export** drops all imported data.

Not affiliated with Netflix.

## Get your data

1. Request your data from Netflix: Account → Security / Privacy → **Request my information** (Member Information Request).
2. Wait for the email, download the ZIP, and unzip it.
3. Run the app below and click **Choose folder** on the landing screen, selecting the extracted folder.

Expected files (names vary by export): `ViewingActivity.csv`, `SearchHistory.csv`, `Ratings.csv`, `MyList.csv`, `Profiles.csv`, `Devices.csv`, `IpAddressesLogin.csv`, `IpAddressesStreaming.csv`, `AccessAndDevices.csv`, `BillingHistory.csv`, `SubscriptionHistory.csv`, `MessagesSentByNetflix.csv`, `ChatTranscripts.csv`, `CSContact.csv`, `GamePlaySession.csv`, `AccountDetails.csv`, `TermsOfUse.csv`.

## Features

12 URL-synced tabs (TanStack Router, hash history), reached from the left sidebar. The sidebar also carries a Files section: all 25 source files grouped in 11 folders with live record counts, each opening a dedicated per-file page (`#/file/…`):

| Tab | Source files |
| --- | --- |
| Overview | ViewingActivity, Profiles, BillingHistory, Devices, AccountDetails |
| Viewing | ViewingActivity |
| Discovery | SearchHistory (+ optional AI title matching) |
| Ratings & My List | Ratings, MyList |
| Profiles | Profiles, ViewingActivity |
| Devices & locations | Devices, IpAddressesLogin/Streaming, AccessAndDevices |
| Billing | BillingHistory, SubscriptionHistory |
| Messages & support | MessagesSentByNetflix, ChatTranscripts, CSContact |
| Games | GamePlaySession |
| Account | AccountDetails, TermsOfUse |
<!-- | Ask | RAG/agent/KG over the loaded export | (Ask tab temporarily disabled) -->
| Data explorer | Raw ViewingActivity grid |

Every tab has KPI cards, a data-driven insights card, and a monthly time chart. Devices adds a tile-grid geo map with per-region drill-down. All charts open icon-only fullscreen.

Tables: TanStack Table + TanStack Virtual — sortable, searchable, virtualized grids with faceted filter chips. No pagination; all records reachable. Tables span the full card width and show every source column.

UX details:

- Dark brand theme by default with a persisted light-theme toggle in the header; charts, tables, and maps adapt via theme tokens.
- Grouped time charts use the 4-color profile palette (`--profile-1..4` in `src/index.css`).
- Skeleton loading states mirror each tab's layout while its source files parse.
- Route loaders pre-parse each tab's files; hover/focus intent preloading starts the load before the click. Visited tabs stay mounted for instant revisits.

More screenshots: `screenshots/` also holds landing, geomap, and 390px mobile variants.

## Screenshots

Every tab, dark and light (1440px, regenerated with `node scripts/shots-tabs.mjs`):

| Tab | Dark | Light |
| --- | --- | --- |
| Overview | <img src="screenshots/overview-1440.png" width="420" alt="Overview dark"> | <img src="screenshots/overview-light-1440.png" width="420" alt="Overview light"> |
| Viewing | <img src="screenshots/viewing-1440.png" width="420" alt="Viewing dark"> | <img src="screenshots/viewing-light-1440.png" width="420" alt="Viewing light"> |
| Discovery | <img src="screenshots/discovery-1440.png" width="420" alt="Discovery dark"> | <img src="screenshots/discovery-light-1440.png" width="420" alt="Discovery light"> |
| Ratings & My List | <img src="screenshots/ratings-1440.png" width="420" alt="Ratings dark"> | <img src="screenshots/ratings-light-1440.png" width="420" alt="Ratings light"> |
| Profiles | <img src="screenshots/profiles-1440.png" width="420" alt="Profiles dark"> | <img src="screenshots/profiles-light-1440.png" width="420" alt="Profiles light"> |
| Devices & locations | <img src="screenshots/devices-1440.png" width="420" alt="Devices dark"> | <img src="screenshots/devices-light-1440.png" width="420" alt="Devices light"> |
| Billing | <img src="screenshots/billing-1440.png" width="420" alt="Billing dark"> | <img src="screenshots/billing-light-1440.png" width="420" alt="Billing light"> |
| Messages & support | <img src="screenshots/messages-1440.png" width="420" alt="Messages dark"> | <img src="screenshots/messages-light-1440.png" width="420" alt="Messages light"> |
| Games | <img src="screenshots/games-1440.png" width="420" alt="Games dark"> | <img src="screenshots/games-light-1440.png" width="420" alt="Games light"> |
| Account | <img src="screenshots/account-1440.png" width="420" alt="Account dark"> | <img src="screenshots/account-light-1440.png" width="420" alt="Account light"> |
<!-- | Ask | <img src="screenshots/ask-1440.png" width="420" alt="Ask dark"> | <img src="screenshots/ask-light-1440.png" width="420" alt="Ask light"> | (Ask tab temporarily disabled) -->
| Data explorer | <img src="screenshots/explorer-1440.png" width="420" alt="Explorer dark"> | <img src="screenshots/explorer-light-1440.png" width="420" alt="Explorer light"> |

## Optional AI features (BYO key, off by default)

Powered by TypeSafe Jev (`jev-latest`):

- **Discovery title matching**: judges ambiguous cross-file title pairs and merges true matches.
- **Ask tab**: RAG, agentic, and knowledge-graph querying over the export. Plain-language questions route to typed tools (function-calling), evidence is reranked and citation-checked, multi-step questions run a confidence-gated agent loop (max 4 steps), and shows/profiles/devices/regions form a code-built knowledge graph. Code retrieves, Jev judges, answers assemble from rows — nothing is generated.

Setup:

```sh
cp .env.example .env
# edit .env and set VITE_TYPESAFE_API_KEY=<your key>
```

The key is stored only in the browser. Only title/question strings leave the browser, via a same-origin dev/preview proxy (`/typesafe-api` → `https://api.typesafe.ai`, see `vite.config.ts`) because the API rejects browser origins (CORS). Never commit `.env`.

## Run it

npm is the canonical package manager; `package-lock.json` is the single lockfile.

```sh
npm install
npm run dev      # development server
npm run build    # typecheck + production build
npm run lint     # oxlint
npm test         # unit tests (Vitest)
npm run preview  # serve the production build
```

Then open the printed URL, unzip your Netflix export, and choose the extracted folder in the import screen.

## Project structure

```text
src/
  App.tsx            # 12-tab shell, import/clear, theme toggle
  router.tsx         # hash-history routes + per-tab file preload map
  shell.tsx          # root layout / not-found
  tabs/              # Overview, Viewing, Discovery, Ratings, Profiles,
                     # Devices, Billing, Messages, Games, Account, Ask, FileView
  components/        # Sidebar, DataGrid, TimeChart, ChartFrame, GeoMap, Explorer, TitleMatch, Heatmap
  lib/               # store.ts (Zustand), analytics.ts, title-match.ts, jev.ts, ask/
                     # files.ts (folder groups, slugs, pretty names), profiles.ts (palette rule)
  index.css          # Tailwind v4 theme tokens, profile palette
scripts/
  smoke.mjs          # full 12-tab sweep against a real export
  verify-charts.mjs  # trend, Sankey, funnel, heatmap drill-down, fullscreen
  verify-chips.mjs   # filter-chip select / multi-select / removal / clear-all
  shots.mjs          # screenshot helper
screenshots/         # committed UI captures (dark, light, mobile)
plans/               # implementation plans
```

## Tech

- React 19 + TypeScript + Vite, Tailwind CSS v4, React Compiler (auto-memoization — no manual useMemo/useCallback/memo), lodash-es utilities
- shadcn components (Base UI primitives: Button, Card, Dialog, Tabs, Table, Badge, Input, Select, Alert, Label, Separator, Tooltip), dark mode by default
- Recharts (trend lines, area, funnel, Sankey, heatmap grids), TanStack Table + TanStack Virtual, Zustand (in-memory store)
- TanStack Router (hash history) with URL-synced tabs
- TypeSafe JS SDK (`@typesafe-ai/sdk`) for opt-in Jev judgments

## Verification

- `scripts/smoke.mjs` — full tab sweep against a real export, incl. heatmap dialogs, fullscreen charts, sorting, clear/reimport
- `scripts/verify-charts.mjs` — trend, Sankey, funnel, heatmap drill-down, fullscreen, no-slice checks
- `scripts/verify-chips.mjs` — filter-chip select / multi-select / removal / clear-all against real data

Each script serves `dist/` over HTTP and drives it with Playwright Chromium. Build the app first (`npm run build`).

## Contributing

See [AGENTS.md](AGENTS.md) for agent/conventions and [SKILLS.md](SKILLS.md) for the installed skill index.

## License

MIT — see [LICENSE](LICENSE).
