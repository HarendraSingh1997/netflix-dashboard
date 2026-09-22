import type { CSSProperties, ReactNode } from 'react'
import DataGrid from './DataGrid'
import { ChartFrame } from './ChartFrame'
import { Card as ShadCard, CardContent } from './ui/card'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <ShadCard className={`min-w-0 rounded-none border-line bg-panel text-body ring-0 ${className}`}>
      <CardContent>{children}</CardContent>
    </ShadCard>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="flex flex-col gap-3 py-6">
      <div className="display-md tabular-nums break-words max-md:text-[24px] max-md:tracking-[1.5px]">{value}</div>
      <div className="caption-mono">{label}</div>
      {sub && <div className="font-body text-sm text-subtle">{sub}</div>}
    </Card>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="display-sm mb-6">{children}</h2>
}

export function Empty({ label = 'No data available' }: { label?: string }) {
  return (
    <Card className="py-10 text-center font-body text-base text-subtle">
      {label}
    </Card>
  )
}

export function BarList({ data, unit = '', title = 'Ranked distribution' }: { data: { name: string; value: number }[]; unit?: string; title?: string }) {
  const max = data.reduce((value, row) => Math.max(value, row.value), 1)
  const rows = data.map((row) => ({ Category: row.name, Value: row.value }))
  return <ChartFrame title={title}><DataGrid rows={rows} columns={['Category', 'Value']} renderValue={(column, value) => column === 'Value' ? <div className="min-w-36"><span className="font-mono text-xs tabular-nums">{Number(value).toLocaleString()}{unit}</span><div className="mt-2 h-px bg-line"><div className="h-px bg-ink" style={{ width: `${Number(value) / max * 100}%`, opacity: 0.3 + 0.7 * (Number(value) / max) }} /></div></div> : <span className="font-body text-base">{String(value)}</span>} /></ChartFrame>
}

export function Table({ rows, cols }: { rows: Record<string, unknown>[]; cols?: string[] }) {
  return <DataGrid rows={rows} columns={cols} />
}

export function KpiGrid({ items }: { items: { label: string; value: ReactNode; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-line bg-line xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-3 bg-panel p-6">
          <div className="display-md tabular-nums break-words max-md:text-[24px] max-md:tracking-[1.5px]">{item.value}</div>
          <div className="caption-mono">{item.label}</div>
          {item.sub && <div className="font-body text-sm text-subtle">{item.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function InsightsCard({ items, title = 'Key insights' }: { items: string[]; title?: string }) {
  if (!items.length) return null
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <ul className="space-y-5">
        {items.map((text, i) => (
          <li key={i} className="flex gap-4">
            <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 bg-ink" />
            <span className="font-body text-lg leading-relaxed text-body">{text}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* Loading skeletons: theme-token pulse blocks that mirror each section's layout,
   so parsed content swaps in with no layout shift. Animation is disabled globally
   under prefers-reduced-motion. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" style={style} className={`animate-pulse bg-line ${className}`} />
}

export function SkeletonTitle({ className = 'w-2/3 max-w-md' }: { className?: string }) {
  return <Skeleton className={`h-12 ${className}`} />
}

export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-line bg-line xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-3 bg-panel p-6">
          <Skeleton className="h-8 max-md:h-6" />
          <Skeleton className="h-[15px] w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonInsights({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <Skeleton className="mb-6 h-6 w-48" />
      <ul className="space-y-5">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex gap-4">
            <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 bg-line" />
            <Skeleton className="h-[22px] flex-1" />
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function SkeletonChart({ height = 300, framed = true }: { height?: number; framed?: boolean }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-[15px] w-44" />
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line" />
      </div>
      <Skeleton style={{ height }} className="w-full" />
    </>
  )
  if (!framed) return <section className="min-w-0 space-y-6">{body}</section>
  return (
    <Card>
      <Skeleton className="mb-6 h-6 w-56" />
      <div className="space-y-6">{body}</div>
    </Card>
  )
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <Skeleton className="mb-6 h-6 w-48" />
      <div className="-mx-6 space-y-2" aria-hidden="true">
        <div className="flex gap-6 px-6 py-4">
          {Array.from({ length: cols }, (_, i) => <Skeleton key={i} className="h-[15px] flex-1" />)}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-6 border-t border-line px-6 py-4">
            {Array.from({ length: cols }, (_, j) => <Skeleton key={j} className="h-4 flex-1" />)}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Full-tab loading state. Compose with the same section rhythm as the real tab:
 *  page title, KPI grid, insights, then chart/card/table blocks. */
export function TabSkeleton({
  title = true,
  kpis = 4,
  insights = true,
  charts = 1,
  cards = 0,
  table = false,
  columns = 1,
}: {
  title?: boolean
  kpis?: number
  insights?: boolean
  charts?: number
  cards?: number
  table?: boolean
  columns?: 1 | 2 | 3
}) {
  const grid = columns === 2 ? 'grid lg:grid-cols-2 gap-4' : 'grid lg:grid-cols-3 gap-4'
  return (
    <div className="space-y-[120px]" role="status" aria-label="Loading tab data">
      <div className="space-y-6">
        {title && <SkeletonTitle />}
        <SkeletonKpiGrid count={kpis} />
      </div>
      {insights && <SkeletonInsights />}
      {Array.from({ length: charts }, (_, i) => <SkeletonChart key={`chart-${i}`} />)}
      {cards > 0 && (columns === 1
        ? Array.from({ length: cards }, (_, i) => <SkeletonTable key={`card-${i}`} rows={6} cols={2} />)
        : <div className={grid}>{Array.from({ length: cards }, (_, i) => <SkeletonTable key={`card-${i}`} rows={6} cols={2} />)}</div>)}
      {table && <SkeletonTable />}
    </div>
  )
}
