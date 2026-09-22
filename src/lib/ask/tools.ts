/** Typed tools over the in-memory export. Pure retrieval + aggregation —
 *  no API calls, no prose. Jev (dispatcher) picks the tool and fills closed-set
 *  args; code here executes and returns evidence the UI renders. */

import { monthlySeries, monthlyViewing } from '../analytics'
import { topN } from '../utils'
import { candidateShows, connections, lookupShow, type Graph } from './graph'

export type DatasetId = 'viewing' | 'searches' | 'ratings' | 'mylist' | 'billing' | 'messages'

export interface DatasetMeta {
  file: string
  dateField?: string
  titleField?: string
  description: string
}

export const DATASETS: Record<DatasetId, DatasetMeta> = {
  viewing: { file: 'ViewingActivity.csv', dateField: 'Start Time', titleField: 'Title', description: 'playback records with title, profile, device, duration' },
  searches: { file: 'SearchHistory.csv', dateField: 'Utc Timestamp', titleField: 'Displayed Name', description: 'search events with query, action, section, device' },
  ratings: { file: 'Ratings.csv', dateField: 'Event Utc Ts', titleField: 'Title Name', description: 'thumb and star ratings by title' },
  mylist: { file: 'MyList.csv', dateField: 'Utc Title Add Date', titleField: 'Title Name', description: 'My List additions by title' },
  billing: { file: 'BillingHistory.csv', dateField: 'Transaction Date', description: 'settled subscription invoices' },
  messages: { file: 'MessagesSentByNetflix.csv', dateField: 'Sent Utc Ts', description: 'messages sent by Netflix with channel and name' },
}

export type Row = Record<string, string>

export interface ToolContext {
  rows: (file: string) => Row[]
  graph: Graph
}

export interface EvidenceRow {
  [k: string]: string | number
}

export interface ToolResult {
  /** One-line claim the UI renders, e.g. "Top profile is Harry (5,188 sessions)". */
  claim: string
  rows: EvidenceRow[]
  chart?: { data: { month: string; value: number }[]; label: string }
}

export interface ToolDef {
  description: string
  run: (ctx: ToolContext, args: Record<string, string | number>) => ToolResult
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 10))

export const TOOLS: Record<string, ToolDef> = {
  topValues: {
    description: 'Ranked most-common values of one field, e.g. top titles, profiles, or devices',
    run: (ctx, args) => {
      const dataset = args.dataset as DatasetId
      const field = String(args.field ?? '')
      const n = num(args.n)
      const rows = ctx.rows(DATASETS[dataset].file)
      const ranked = topN(
        rows.map((r) => ({ ...r })),
        (r) => (r as Row)[field] ?? '',
      ).slice(0, n)
      const top = ranked[0]
      return {
        claim: top
          ? `Top ${field} in ${dataset} is “${top.name}” (${top.value.toLocaleString()}).`
          : `No values found for ${field} in ${dataset}.`,
        rows: ranked.map((r, i) => ({ Rank: i + 1, Value: r.name, Count: r.value })),
      }
    },
  },
  filterRows: {
    description: 'Rows where one field contains a value, e.g. one profile’s sessions or one title’s records',
    run: (ctx, args) => {
      const dataset = args.dataset as DatasetId
      const field = String(args.field ?? '')
      const value = String(args.value ?? '').toLowerCase()
      const rows = ctx.rows(DATASETS[dataset].file)
      const matched = rows.filter((r) => ((r[field] ?? '').toLowerCase().includes(value)))
      const sample = matched.slice(0, 200)
      return {
        claim: `${matched.length.toLocaleString()} of ${rows.length.toLocaleString()} ${dataset} rows match ${field} ≈ “${args.value}”.`,
        rows: sample.map((r) => Object.fromEntries(Object.entries(r).slice(0, 8)) as EvidenceRow),
      }
    },
  },
  monthlyTrend: {
    description: 'Month-by-month totals for one dataset, e.g. watch time or message volume over time',
    run: (ctx, args) => {
      const dataset = args.dataset as DatasetId
      const meta = DATASETS[dataset]
      const rows = ctx.rows(meta.file)
      const data =
        dataset === 'viewing'
          ? monthlyViewing(rows).map((d) => ({ month: d.month, value: d.hours }))
          : monthlySeries(rows, meta.dateField ?? '').map((d) => ({ month: d.month, value: Number(d.value) }))
      const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0])
      const total = data.reduce((s, d) => s + d.value, 0)
      return {
        claim: peak
          ? `Peak month is ${peak.month} (${Math.round(peak.value).toLocaleString()} of ${Math.round(total).toLocaleString()} total).`
          : `No dated rows in ${dataset}.`,
        rows: data.map((d) => ({ Month: d.month, Value: Math.round(d.value * 10) / 10 })),
        chart: data.length ? { data, label: dataset === 'viewing' ? 'Hours' : 'Events' } : undefined,
      }
    },
  },
  compareProfiles: {
    description: 'Per-profile activity totals from viewing or search records',
    run: (ctx, args) => {
      const source = (args.source as string) === 'searches' ? 'searches' : 'viewing'
      const rows = ctx.rows(DATASETS[source].file)
      const ranked = topN(rows, (r) => r['Profile Name'] ?? '')
      const top = ranked[0]
      return {
        claim: top
          ? `Most active profile in ${source} is ${top.name} (${top.value.toLocaleString()} records).`
          : `No profile records in ${source}.`,
        rows: ranked.map((r) => ({ Profile: r.name || '(blank)', Records: r.value })),
      }
    },
  },
  entityLookup: {
    description: 'Everything the export knows about one show: sessions, plays, ratings, profiles, devices',
    run: (ctx, args) => {
      const name = String(args.name ?? '')
      const node = lookupShow(ctx.graph, name)
      if (!node) {
        return {
          claim: `“${name}” matches nothing — see candidate disambiguation.`,
          rows: candidateShows(ctx.graph, name).map((t) => ({ Candidate: t })),
        }
      }
      return {
        claim: `“${node.title}”: ${node.sessions.toLocaleString()} sessions, ${node.plays.toLocaleString()} search plays, ${node.ratings.toLocaleString()} ratings.`,
        rows: [
          { Aspect: 'Profiles', Detail: node.profiles.join(', ') || '—' },
          { Aspect: 'Devices', Detail: node.devices.join(', ') || '—' },
          { Aspect: 'Regions', Detail: node.regions.join(', ') || '—' },
          { Aspect: 'On My List', Detail: node.onList ? 'Yes' : 'No' },
        ],
      }
    },
  },
  connections: {
    description: 'What connects two shows: shared profiles, devices, regions',
    run: (ctx, args) => {
      const a = String(args.a ?? '')
      const b = String(args.b ?? '')
      const links = connections(ctx.graph, a, b)
      if (!links) {
        return {
          claim: `Could not resolve both titles — try entityLookup on each name first.`,
          rows: [],
        }
      }
      const parts = [
        `${links.profiles.length} shared profiles`,
        `${links.devices.length} shared devices`,
        `${links.regions.length} shared regions`,
      ]
      return {
        claim: `“${a}” and “${b}” share ${parts.join(', ')}.`,
        rows: [
          { Link: 'Profiles', Detail: links.profiles.join(', ') || '—' },
          { Link: 'Devices', Detail: links.devices.join(', ') || '—' },
          { Link: 'Regions', Detail: links.regions.join(', ') || '—' },
        ],
      }
    },
  },
  listFiles: {
    description: 'Which export files are present and how many rows each holds',
    run: (ctx) => {
      const rows = (Object.keys(DATASETS) as DatasetId[]).map((id) => ({
        Dataset: id,
        File: DATASETS[id].file,
        Records: ctx.rows(DATASETS[id].file).length,
      }))
      return {
        claim: `${rows.filter((r) => (r.Records as number) > 0).length} of ${rows.length} datasets have data.`,
        rows,
      }
    },
  },
}
