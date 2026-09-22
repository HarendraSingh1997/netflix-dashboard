import Papa from 'papaparse'
import { countBy, groupBy, orderBy, sumBy } from 'lodash-es'

export type Row = Record<string, string>

export function parseText(name: string, text: string): Row[] {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed || /^no data found$/i.test(trimmed)) return []
  if (!name.toLowerCase().endsWith('.csv')) return [{ Value: trimmed }]
  const result = Papa.parse<Row>(trimmed, {
    header: true,
    delimiter: ',',
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })
  if (result.errors.length) {
    const error = result.errors[0]
    throw new Error(`Invalid CSV: ${error.code}${error.row == null ? '' : ` near row ${error.row + 2}`}`)
  }
  return result.data
}

export async function parseCsv(file: File): Promise<Row[]> {
  return parseText(file.name, await file.text())
}

export function toSeconds(value: string): number {
  if (!value?.trim() || !/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(value.trim())) return 0
  const parts = value.trim().split(':').map(Number)
  if (parts.slice(1).some((part) => part >= 60)) return 0
  const result = parts.reduce((sum, part) => sum * 60 + part, 0)
  return Number.isFinite(result) ? result : 0
}

export function fmtDuration(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))
  const days = Math.floor(value / 86400)
  const hours = Math.floor(value % 86400 / 3600)
  const minutes = Math.floor(value % 3600 / 60)
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m`
  return `${value}s`
}

export function fmtHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`
}

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
export function fmtNum(value: number): string {
  return numberFormat.format(value)
}

export function parseTs(value: string): Date | null {
  if (!value?.trim()) return null
  let normalized = value.trim().replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += 'T00:00:00Z'
  else if (!/(Z|[+-]\d{2}:\d{2})$/i.test(normalized)) normalized += 'Z'
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function fmtDate(value: string): string {
  const date = parseTs(value)
  return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—'
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function minMax(values: number[]): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

export function topN<T>(items: T[], key: (item: T) => string, count?: number): { name: string; value: number }[] {
  const ranked = orderBy(
    Object.entries(countBy(items, (item) => key(item) || '\0')).map(([name, value]) => ({ name, value })),
    ['value'],
    ['desc'],
  ).filter((row) => row.name !== '\0')
  return count === undefined ? ranked : ranked.slice(0, Math.max(0, count))
}

export function settledInvoices(rows: Row[]): Row[] {
  return rows.filter((row) => row['Final Invoice Result'] === 'SETTLED' && row.Description === 'SUBSCRIPTION')
}

export function totalsByCurrency(rows: Row[]): { name: string; value: number }[] {
  return Object.entries(
    groupBy(
      settledInvoices(rows).filter((row) => Number.isFinite(Number(row['Gross Sale Amt']))),
      (row) => row.Currency || 'Unknown currency',
    ),
  ).map(([name, group]) => ({ name, value: sumBy(group, (row) => Number(row['Gross Sale Amt'])) }))
}
