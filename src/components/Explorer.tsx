import { useState } from 'react'
import { useApp, useFile } from '../lib/store'
import { fmtNum, type Row } from '../lib/utils'
import { Card, Empty, InsightsCard, KpiGrid, SectionTitle, SkeletonTable } from './ui'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select'
import DataGrid from './DataGrid'
import { FolderOpen } from 'lucide-react'

export function DataTable({ rows, columns }: { rows: Row[]; columns?: string[] }) {
  return <DataGrid rows={rows} columns={columns} />
}

export function FileData({ name }: { name: string }) {
  const entry = useFile(name)
  if (!entry || entry.status === 'missing') return <Empty label={`${name} was not included in this export.`} />
  if (entry.status === 'queued' || entry.status === 'loading') return <div role="status" aria-label={`Loading ${name}`}><SkeletonTable /></div>
  if (entry.status === 'error') return <p role="alert" className="py-4 font-body text-base text-warning">{entry.error}. Reimport the original file to try again.</p>
  if (entry.status === 'document') return <Empty label="PDF included in the export. Open the original document on your computer; document contents are not parsed." />
  if (!entry.rows.length) return <Empty label="This file contains no data." />
  return <DataTable key={name} rows={entry.rows} />
}

export function SourcePanel({ name, title }: { name: string; title?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <Button variant="ghost" style={{ borderRadius: 0 }} className="flex h-auto w-full items-center justify-between gap-4 px-0 py-2" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="title-md">{title ?? name.replace(/\.\w+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
        <span aria-hidden="true" className="font-mono text-subtle">{open ? '−' : '+'}</span>
      </Button>
      {open && <div className="mt-6"><FileData name={name} /></div>}
    </Card>
  )
}

export default function Explorer() {
  const files = useApp((state) => state.files)
  const [selected, setSelected] = useState('ViewingActivity.csv')
  const names = Object.keys(files).sort()
  const stats = (() => {
    const entries = Object.values(files)
    const ready = entries.filter((f) => f.status === 'ready')
    const records = ready.reduce((sum, f) => sum + f.rows.length, 0)
    const largest = [...ready].sort((a, b) => b.rows.length - a.rows.length)[0]
    const empty = entries.filter((f) => f.status === 'ready' && !f.rows.length).map((f) => f.name)
    return { files: entries.length, records, largest, empty }
  })()
  return <div className="space-y-[120px]">
    <div className="space-y-6">
      <h1 className="page-title">Data explorer</h1>
      <p className="font-body text-lg text-body">Inspect every source locally. Raw records can contain personal information.</p>
      <KpiGrid items={[
        { label: 'Source files', value: stats.files },
        { label: 'Parsed records', value: stats.records.toLocaleString(), sub: 'across all ready files' },
        { label: 'Largest file', value: stats.largest?.name.replace(/\.(csv|txt)$/i, '') ?? '—', sub: stats.largest ? `${stats.largest.rows.length.toLocaleString()} records` : undefined },
        { label: 'Empty files', value: stats.empty.length, sub: stats.empty.length ? 'reported “no data”' : 'every file has data' },
      ]} />
    </div>
    <InsightsCard
      title="Export notes"
      items={[
        ...(stats.largest ? [`${stats.largest.name} dominates the export at ${stats.largest.rows.length.toLocaleString()} records — tables virtualize, so scrolling stays smooth.`] : []),
        ...(stats.empty.length ? [`${stats.empty.join(', ')} contain${stats.empty.length === 1 ? 's' : ''} no data in this export.`] : []),
        'Every table sorts, searches, and filters with chips; all records are reachable — nothing is sampled.',
      ]}
    />
    <Card>
      <SectionTitle>Source files</SectionTitle>
      <div className="grid gap-2">
        <span className="caption-mono">Source file</span>
        <Select value={selected} onValueChange={(v) => setSelected(v ?? 'ViewingActivity.csv')}>
          <SelectTrigger aria-label="Source file" className="w-full rounded-none border-0 border-b border-rule bg-transparent px-0 font-mono text-xs tracking-[2px] uppercase">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="size-3.5" aria-hidden="true" />
              <span className="truncate font-mono text-xs tracking-[2px] uppercase">{selected}</span>
            </span>
          </SelectTrigger>
          <SelectContent className="rounded-none">{names.map((name) => <SelectItem key={name} value={name} className="font-mono text-xs">{name} — {files[name].status}{files[name].status === 'ready' ? ` (${fmtNum(files[name].rows.length)} records)` : ''}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="mt-10"><FileData key={selected} name={selected} /></div>
    </Card>
    <div className="grid gap-px bg-line sm:grid-cols-2 border border-line">
      {names.map((name) => (
        <Button key={name} variant="ghost" style={{ borderRadius: 0 }} onClick={() => setSelected(name)} aria-current={selected === name ? 'true' : undefined} className={`h-auto justify-between bg-bg px-6 py-4 ${selected === name ? 'text-ink' : 'text-subtle'}`}>
          <span className="flex items-center gap-2">
            <FolderOpen className="size-3.5" aria-hidden="true" />
            <span className="truncate font-mono text-xs tracking-[2px] uppercase">{name}</span>
          </span>
          <span className="caption-mono shrink-0">{files[name].status}</span>
        </Button>
      ))}
    </div>
  </div>
}
