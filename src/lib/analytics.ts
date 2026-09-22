import { countBy, orderBy } from 'lodash-es'
import { parseTs, toSeconds, type Row } from './utils.ts'

export function overviewTrend(viewing: Row[]): { month: string; hours: number }[] {
  return monthlySeries(viewing, 'Start Time', {
    value: (row) => toSeconds(row.Duration),
  }).map((d) => ({ month: d.month, hours: Math.round(Number(d.value) / 36) / 100 }))
}

export function peakMonth(trend: { month: string; hours: number }[]): { month: string; hours: number } | undefined {
  if (!trend.length) return undefined
  return trend.reduce((a, b) => (b.hours > a.hours ? b : a))
}

export function regionKey(row: Row): string {
  return row['Region Code Display Name'] || row['Region Code'] || ''
}

export function combinedRegions(streaming: Row[], logins: Row[]): { name: string; value: number }[] {
  return orderBy(
    Object.entries(countBy([...streaming, ...logins], regionKey)).map(([name, value]) => ({ name, value })),
    ['value'],
    ['desc'],
  ).filter((row) => row.name !== '')
}

export function monthlyViewing(rows: Row[]) {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const date = parseTs(row['Start Time'])
    if (!date) continue
    const key = date.toISOString().slice(0, 7)
    totals.set(key, (totals.get(key) ?? 0) + toSeconds(row.Duration) / 3600)
  }
  const keys = [...totals.keys()].sort()
  if (!keys.length) return []
  const cursor = new Date(`${keys[0]}-01T00:00:00Z`)
  const last = keys[keys.length - 1]
  const result: { month: string; hours: number }[] = []
  while (cursor.toISOString().slice(0, 7) <= last) {
    const month = cursor.toISOString().slice(0, 7)
    result.push({ month, hours: totals.get(month) ?? 0 })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return result
}

export function monthRange(rows: Row[], dateField: string): string[] {
  const keys = new Set<string>()
  for (const row of rows) {
    const date = parseTs(row[dateField])
    if (date) keys.add(date.toISOString().slice(0, 7))
  }
  const sorted = [...keys].sort()
  if (!sorted.length) return []
  const cursor = new Date(`${sorted[0]}-01T00:00:00Z`)
  const last = sorted[sorted.length - 1]
  const out: string[] = []
  while (cursor.toISOString().slice(0, 7) <= last) {
    out.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return out
}

export function monthlySeries(
  rows: Row[],
  dateField: string,
  opts: { groupField?: string; topGroups?: number; value?: (row: Row) => number } = {},
): { month: string; [series: string]: number | string }[] {
  const { groupField, topGroups = 4, value } = opts
  const totals = new Map<string, number>()
  if (groupField) {
    for (const row of rows) {
      const key = row[groupField] || 'Unknown'
      totals.set(key, (totals.get(key) ?? 0) + 1)
    }
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, topGroups).map(([k]) => k)
  const topSet = new Set(top)
  const seriesKeys = groupField ? [...top, ...(totals.size > top.length ? ['Other'] : [])] : ['value']
  const buckets = new Map<string, Map<string, number>>()
  for (const month of monthRange(rows, dateField)) {
    buckets.set(month, new Map(seriesKeys.map((k) => [k, 0])))
  }
  for (const row of rows) {
    const date = parseTs(row[dateField])
    if (!date) continue
    const bucket = buckets.get(date.toISOString().slice(0, 7))
    if (!bucket) continue
    const amount = value ? value(row) : 1
    if (!Number.isFinite(amount)) continue
    const key = groupField ? (topSet.has(row[groupField] || 'Unknown') ? (row[groupField] || 'Unknown') : 'Other') : 'value'
    bucket.set(key, (bucket.get(key) ?? 0) + amount)
  }
  return [...buckets.entries()].map(([month, map]) => ({ month, ...Object.fromEntries(map) }))
}

export function searchFunnel(rows: Row[]) {
  const action = (row: Row) => (row.Action ?? '').toLowerCase()
  return [
    { name: 'All search events', value: rows.length, fill: 'var(--color-ink)' },
    { name: 'Select or play events', value: rows.filter((row) => ['select', 'play'].includes(action(row))).length, fill: 'var(--color-subtle)' },
    { name: 'Play events', value: rows.filter((row) => action(row) === 'play').length, fill: 'var(--color-faint)' },
  ]
}

export function viewingFlow(rows: Row[]) {
  const nodes: { name: string }[] = []
  const index = new Map<string, number>()
  const links = new Map<string, { source: number; target: number; value: number }>()
  const node = (stage: string, value: string) => {
    const key = `${stage}:${value || 'Unknown'}`
    if (!index.has(key)) { index.set(key, nodes.length); nodes.push({ name: key }) }
    return index.get(key)!
  }
  for (const row of rows) {
    const source = node('Profile', row['Profile Name'])
    const target = node('Device', row['Device Type'])
    const key = `${source}:${target}`
    const link = links.get(key) ?? { source, target, value: 0 }
    link.value++
    links.set(key, link)
  }
  return { nodes, links: [...links.values()] }
}
