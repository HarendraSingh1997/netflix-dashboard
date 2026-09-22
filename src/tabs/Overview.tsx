import { usePending, useRows } from '../lib/store'
import { fmtDate, fmtDuration, fmtNum, minMax, parseTs, toSeconds, topN, totalsByCurrency } from '../lib/utils'
import { overviewTrend, peakMonth } from '../lib/analytics'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, TabSkeleton } from '../components/ui'
import TimeChart from '../components/TimeChart'

export default function Overview() {
  const viewing = useRows('ViewingActivity.csv')
  const profiles = useRows('Profiles.csv')
  const billing = useRows('BillingHistory.csv')
  const devices = useRows('Devices.csv')
  const account = useRows('AccountDetails.csv')
  const pending = usePending('ViewingActivity.csv', 'Profiles.csv', 'BillingHistory.csv', 'Devices.csv', 'AccountDetails.csv')
  const totalSeconds = viewing.reduce((sum, row) => sum + toSeconds(row.Duration), 0)
  const spend = totalsByCurrency(billing)
  const trend = overviewTrend(viewing)

  const insights = (() => {
    if (!viewing.length) return []
    const out: string[] = []
    const titles = topN(viewing, (row) => row.Title)
    if (titles[0]) out.push(`“${titles[0].name}” leads with ${titles[0].value.toLocaleString()} plays — ${Math.round(titles[0].value / viewing.length * 100)}% of every playback record.`)
    const byProfile = topN(viewing, (row) => row['Profile Name'])
    if (byProfile[0]) out.push(`${byProfile[0].name} is the most active profile at ${byProfile[0].value.toLocaleString()} records (${Math.round(byProfile[0].value / viewing.length * 100)}% of the total).`)
    const peak = peakMonth(trend)
    if (peak) out.push(`${peak.month} was the peak month with ${fmtDuration(peak.hours * 3600)} recorded.`)
    const times: number[] = []
    for (const row of viewing) {
      const d = parseTs(row['Start Time'])
      if (d) times.push(d.getTime())
    }
    if (times.length > 1) {
      const { min, max } = minMax(times)
      const span = Math.round((max - min) / 86400000 / 30.4)
      out.push(`Viewing history spans about ${span} months — playback records include previews and trailers, not just finished titles.`)
    }
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={1} cards={2} columns={2} />

  return <div className="space-y-[120px]">
    <div className="space-y-6">
      <div><h1 className="page-title">Your time on Netflix</h1><p className="mt-6 font-body text-lg text-body">Member since {fmtDate(account[0]?.['Customer Creation Timestamp'])}. A perspective on the records in your export.</p></div>
      <KpiGrid items={[
        { label: 'Recorded watch time', value: fmtDuration(totalSeconds), sub: `${fmtNum(viewing.length)} playback records, including previews` },
        { label: 'Current profiles', value: profiles.length, sub: 'Historical profile names may also appear' },
        { label: 'Devices in export', value: new Set(devices.map((row) => row.Esn).filter(Boolean)).size, sub: 'Unique device identifiers' },
        { label: 'Settled subscription invoices', value: spend.length ? spend.map((item) => `${item.name} ${fmtNum(item.value)}`).join(' / ') : '—', sub: 'Not lifetime spend; limited to this export' },
      ]} />
    </div>
    <InsightsCard items={insights} />
    <TimeChart title="Watch time over time" data={trend} series={[{ key: 'hours', label: 'Hours' }]} unit="h" />
    <div className="grid lg:grid-cols-2 gap-10">
      <Card><SectionTitle>Most played titles</SectionTitle>{viewing.length ? <BarList data={topN(viewing, (row) => row.Title, 10)} unit=" plays" title="Titles ranked by plays" /> : <Empty label="No viewing records available." />}</Card>
      <Card><SectionTitle>Playback records by profile</SectionTitle><BarList data={topN(viewing, (row) => row['Profile Name'], 12)} unit=" plays" title="Profiles ranked by records" /><p className="mt-6 font-body text-base text-subtle">Explore Viewing for monthly watch time and your weekly rhythm. Profile names are taken directly from the export, including older profiles.</p></Card>
    </div>
    <Card><SectionTitle>A note about your data</SectionTitle><p className="font-body text-base leading-relaxed text-subtle">Netflix exports cover different time windows for different files. Playback records are not necessarily completed titles or unique viewing sessions. All dates and heatmap hours use UTC. This dashboard does not infer genres, precise locations, or account security from your records.</p></Card>
  </div>
}
