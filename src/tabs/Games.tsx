
import { usePending, useRows } from '../lib/store'
import { fmtDuration, minMax, parseTs, toSeconds, topN } from '../lib/utils'
import { monthlySeries } from '../lib/analytics'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, TabSkeleton } from '../components/ui'
import TimeChart from '../components/TimeChart'
import { DataTable } from '../components/Explorer'

export default function Games() {
  const rows = useRows('GamePlaySession.csv')
  const pending = usePending('GamePlaySession.csv')
  const totals = (() => {
    const games = new Map<string, number>()
    for (const row of rows) {
      const name = row['Game Title'] || 'Unknown'
      games.set(name, (games.get(name) ?? 0) + toSeconds(row.Duration))
    }
    return [...games].map(([name, seconds]) => ({ name, value: Math.round(seconds / 60) })).sort((a, b) => b.value - a.value)
  })()
  const totalSeconds = (() => {
    let total = 0
    for (const row of rows) total += toSeconds(row.Duration)
    return total
  })()
  const trend = monthlySeries(rows, 'Start Time', {
    value: (row) => toSeconds(row.Duration) / 60,
  }).map((d) => ({ month: d.month, minutes: Math.round(Number(d.value)) }))

  const insights = (() => {
    const out: string[] = []
    if (totals[0] && totalSeconds > 0) out.push(`“${totals[0].name}” takes ${totals[0].value.toLocaleString()} minutes — ${Math.round(totals[0].value / (totalSeconds / 60) * 100)}% of all recorded playtime.`)
    const platforms = topN(rows, (row) => row.Platform)
    if (platforms[0] && rows.length) out.push(`${platforms[0].name} hosts ${platforms[0].value.toLocaleString()} of ${rows.length.toLocaleString()} sessions.`)
    let longest = 0
    for (const row of rows) longest = Math.max(longest, toSeconds(row.Duration))
    if (longest > 0) out.push(`Longest single session: ${fmtDuration(longest)}.`)
    const times: number[] = []
    for (const row of rows) {
      const d = parseTs(row['Start Time'])
      if (d) times.push(d.getTime())
    }
    if (times.length > 1) {
      const { min, max } = minMax(times)
      const months = Math.max(1, Math.round((max - min) / 86400000 / 30.4))
      out.push(`Game activity spans about ${months} months at ${(rows.length / months).toFixed(1)} sessions per month.`)
    }
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={1} cards={2} columns={2} table />
  if (!rows.length) return <Empty label="No game sessions in this export" />

  return <div className="space-y-[120px]">
    <div className="space-y-6">
      <h1 className="page-title">Games</h1>
      <KpiGrid items={[
        { label: 'Recorded sessions', value: rows.length.toLocaleString() },
        { label: 'Games played', value: totals.length },
        { label: 'Recorded playtime', value: fmtDuration(totalSeconds), sub: 'Numeric durations interpreted as seconds' },
        { label: 'Platforms', value: new Set(rows.map((row) => row.Platform).filter(Boolean)).size },
      ]} />
    </div>
    <InsightsCard items={insights} />
    <TimeChart title="Playtime over time" data={trend} series={[{ key: 'minutes', label: 'Minutes' }]} unit="m" />
    <div className="grid lg:grid-cols-2 gap-10">
      <Card><SectionTitle>Playtime by game</SectionTitle><BarList data={totals} unit=" min" title="Games ranked by minutes" /></Card>
      <Card><SectionTitle>Sessions by platform</SectionTitle><BarList data={topN(rows, (row) => row.Platform, 10)} unit=" sessions" title="Platforms ranked by sessions" /></Card>
    </div>
    <Card><SectionTitle>Game sessions</SectionTitle><DataTable rows={rows} /></Card>
  </div>
}
