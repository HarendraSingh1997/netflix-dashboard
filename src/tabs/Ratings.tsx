
import { usePending, useRows } from '../lib/store'
import { fmtDate, minMax, parseTs, topN } from '../lib/utils'
import { monthlySeries } from '../lib/analytics'
import DataGrid from '../components/DataGrid'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, TabSkeleton } from '../components/ui'
import TimeChart from '../components/TimeChart'

export default function Ratings() {
  const ratings = useRows('Ratings.csv')
  const list = useRows('MyList.csv')
  const pending = usePending('Ratings.csv', 'MyList.csv')

  const thumbs = ratings.filter((row) => row['Rating Type'] === 'thumb')
  const up = thumbs.filter((row) => row['Thumbs Value'] === '3').length
  const down = thumbs.filter((row) => row['Thumbs Value'] === '1').length
  const adds = [...list].sort((a, b) => (b['Utc Title Add Date'] ?? '').localeCompare(a['Utc Title Add Date'] ?? ''))
  const trend = (() => {
    const ratedTrend = monthlySeries(ratings, 'Event Utc Ts')
    const addedMap = new Map(monthlySeries(list, 'Utc Title Add Date').map((d) => [d.month, Number(d.value)]))
    return ratedTrend.map((d) => ({ month: d.month, rated: Number(d.value), added: addedMap.get(d.month) ?? 0 }))
  })()

  const insights = (() => {
    const out: string[] = []
    if (thumbs.length) {
      const share = Math.round(up / thumbs.length * 100)
      out.push(`${share}% of thumb ratings are thumbs-up (${up.toLocaleString()} up, ${down.toLocaleString()} down) — a strongly positive-skewed shelf.`)
    }
    const top = topN(ratings, (row) => row['Title Name'])[0]
    if (top) out.push(`Most-rated title: “${top.name}” with ${top.value.toLocaleString()} ratings.`)
    if (adds[0]) out.push(`Latest My List addition: “${adds[0]['Title Name']}” on ${fmtDate(adds[0]['Utc Title Add Date'])}.`)
    const times: number[] = []
    for (const row of ratings) {
      const d = parseTs(row['Event Utc Ts'])
      if (d) times.push(d.getTime())
    }
    if (times.length > 1) {
      const { min, max } = minMax(times)
      const months = Math.max(1, Math.round((max - min) / 86400000 / 30.4))
      out.push(`Rating pace averages ${(ratings.length / months).toFixed(1)} ratings per month over about ${months} months.`)
    }
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={1} cards={2} columns={2} />
  if (!ratings.length && !list.length) return <Empty label="No ratings or list data in this export" />

  return (
    <div className="space-y-[120px]">
      <div className="space-y-6">
        <h1 className="page-title">Ratings &amp; My List</h1>
        <KpiGrid items={[
          { label: 'Ratings given', value: ratings.length.toLocaleString() },
          { label: 'Thumbs up', value: up.toLocaleString(), sub: thumbs.length ? `${Math.round(up / thumbs.length * 100)}% of thumbs` : undefined },
          { label: 'Thumbs down', value: down.toLocaleString() },
          { label: 'My List items', value: list.length.toLocaleString() },
        ]} />
      </div>
      <InsightsCard items={insights} />
      {(ratings.length > 0 || list.length > 0) && (
        <TimeChart title="Ratings and list adds over time" data={trend} series={[{ key: 'rated', label: 'Ratings' }, { key: 'added', label: 'My List adds' }]} />
      )}
      <div className="grid lg:grid-cols-2 gap-10">
        {ratings.length > 0 && (
          <Card>
            <SectionTitle>Most rated titles</SectionTitle>
            <BarList data={topN(ratings, (row) => row['Title Name'], 10)} unit=" ratings" title="Titles ranked by ratings" />
          </Card>
        )}
        {list.length > 0 && (
          <Card>
            <SectionTitle>My List additions</SectionTitle>
            <DataGrid rows={adds} />
          </Card>
        )}
      </div>
    </div>
  )
}
