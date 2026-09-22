import { CartesianGrid, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from 'recharts'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'

import { usePending, useRows } from '../lib/store'
import { parseTs, topN } from '../lib/utils'
import { searchFunnel } from '../lib/analytics'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, TabSkeleton } from '../components/ui'
import { ChartFrame } from '../components/ChartFrame'
import DataGrid from '../components/DataGrid'
import TitleMatch from '../components/TitleMatch'

const tooltipStyle = { background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 0 } as const
const tickStyle = { fill: 'var(--color-subtle)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' } as const

export default function Discovery() {
  const search = useRows('SearchHistory.csv')
  const viewing = useRows('ViewingActivity.csv')
  const ratings = useRows('Ratings.csv')
  const list = useRows('MyList.csv')
  const pending = usePending('SearchHistory.csv', 'ViewingActivity.csv', 'Ratings.csv', 'MyList.csv')
  // Prefetched (not rendered here) so AI title matching sees every title source.
  void [viewing, ratings, list]

  const plays = search.filter((row) => (row['Action'] || '').toLowerCase() === 'play')
  const selects = search.filter((row) => (row['Action'] || '').toLowerCase() === 'select')
  const funnel = searchFunnel(search)
  const trend = (() => {
    const byDay = new Map<string, number>()
    for (const row of search) {
      const date = parseTs(row['Utc Timestamp'])
      if (!date) continue
      const key = date.toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) ?? 0) + 1)
    }
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, events]) => ({ day, events }))
  })()

  const distinctQueries = new Set(search.map((row) => (row['Query Typed'] || '').toLowerCase())).size
  const insights = (() => {
    if (!search.length) return []
    const out: string[] = []
    const top = topN(search, (row) => (row['Query Typed'] || '').toLowerCase())[0]
    if (top) out.push(`“${top.name}” is the most-typed query with ${top.value.toLocaleString()} events.`)
    if (search.length) out.push(`Search-to-play rate is ${((plays.length / search.length) * 100).toFixed(1)}% — ${plays.length.toLocaleString()} plays from ${search.length.toLocaleString()} searches.`)
    const played = topN(plays, (row) => row['Displayed Name'])[0]
    if (played) out.push(`Most played-from-search title: “${played.name}” (${played.value.toLocaleString()} plays).`)
    out.push(`${distinctQueries.toLocaleString()} distinct queries across ${new Set(search.map((row) => row['Profile Name'])).size} profiles.`)
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={2} cards={2} columns={2} table />
  if (!search.length) return <Empty label="No search history found in this export" />

  return (
    <div className="space-y-[120px]">
      <div className="space-y-6">
      <h1 className="page-title">Discovery</h1>
      <KpiGrid items={[
        { label: 'Search events', value: search.length.toLocaleString() },
        { label: 'Distinct queries', value: distinctQueries.toLocaleString() },
        { label: 'Played from search', value: plays.length.toLocaleString() },
        { label: 'Titles clicked', value: selects.length.toLocaleString() },
      ]} />
      </div>
      <InsightsCard items={insights} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Search funnel (all events, nested counts)</SectionTitle>
          <ChartFrame title="Search funnel">
            {(full) => (
              <ResponsiveContainer width="100%" height={full ? 480 : 300}>
                <FunnelChart>
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-ink)', fontFamily: 'JetBrains Mono, monospace' }} />
                  <Funnel dataKey="value" data={funnel} isAnimationActive={false}>
                    <LabelList position="right" fill="var(--color-ink)" stroke="none" dataKey="name" fontSize={12} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            )}
          </ChartFrame>
          <p className="mt-2 text-xs text-subtle">Stages share events: “select or play” includes every “play”. Not a strict conversion journey.</p>
        </Card>
        <Card>
          <SectionTitle>Search activity trend (all days)</SectionTitle>
          <ChartFrame title="Daily search trend">
            {(full) => (
              <ResponsiveContainer width="100%" height={full ? 480 : 300}>
                <AreaChart data={trend}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="day" tick={tickStyle} minTickGap={48} />
                  <YAxis tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-ink)', fontFamily: 'JetBrains Mono, monospace' }} />
                  <Area type="monotone" dataKey="events" fill="color-mix(in srgb, var(--color-ink) 20%, transparent)" stroke="var(--color-ink)" name="Search events" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartFrame>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle>All queries</SectionTitle>
          <BarList data={topN(search, (row) => (row['Query Typed'] || '').toLowerCase())} unit=" searches" title="Queries ranked by events" />
        </Card>
        <Card>
          <SectionTitle>All played titles</SectionTitle>
          {plays.length ? <BarList data={topN(plays, (row) => row['Displayed Name'])} unit=" plays" title="Played titles ranked" /> : <p className="text-sm text-subtle">No plays recorded from search.</p>}
        </Card>
      </div>

      <TitleMatch />
      <Card>
        <SectionTitle>All searches</SectionTitle>
        <DataGrid rows={search} />
      </Card>
    </div>
  )
}
