
import { usePending, useRows } from '../lib/store'
import { fmtDate, parseTs, topN } from '../lib/utils'
import { monthlySeries } from '../lib/analytics'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, TabSkeleton } from '../components/ui'
import TimeChart from '../components/TimeChart'

export default function Profiles() {
  const profiles = useRows('Profiles.csv')
  const viewing = useRows('ViewingActivity.csv')
  const pending = usePending('Profiles.csv', 'ViewingActivity.csv')

  const perProfile = (() => {
    const map = new Map<string, number>()
    for (const row of viewing) {
      const name = row['Profile Name'] || 'Unknown'
      map.set(name, (map.get(name) ?? 0) + 1)
    }
    return map
  })()
  const trend = monthlySeries(viewing, 'Start Time', { groupField: 'Profile Name', topGroups: 4 })
  const trendSeries = (() => {
    const keys = new Set<string>()
    for (const d of trend) for (const k of Object.keys(d)) if (k !== 'month') keys.add(k)
    return [...keys].map((k) => ({ key: k, label: k }))
  })()

  const ranked = [...perProfile.entries()].sort((a, b) => b[1] - a[1])
  const autoplayOn = profiles.filter((row) => row['Has Auto Playback'] === '1').length

  const insights = (() => {
    const out: string[] = []
    if (ranked[0] && viewing.length) out.push(`${ranked[0][0]} dominates playback with ${ranked[0][1].toLocaleString()} records (${Math.round(ranked[0][1] / viewing.length * 100)}% of all sessions).`)
    const created = profiles.map((row) => parseTs(row['Profile Creation Time'])).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())
    if (created.length) out.push(`Profiles were created between ${fmtDate(created[0].toISOString().slice(0, 10))} and ${fmtDate(created[created.length - 1].toISOString().slice(0, 10))}.`)
    out.push(`Autoplay is on for ${autoplayOn} of ${profiles.length} profiles.`)
    if (ranked.length > profiles.length) out.push(`${ranked.length - profiles.length} historical profile name${ranked.length - profiles.length === 1 ? '' : 's'} appear in playback records but no longer exist as profiles.`)
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={1} cards={1} />
  if (!profiles.length) return <Empty label="No profile data in this export" />

  return (
    <div className="space-y-[120px]">
      <div className="space-y-6">
        <h1 className="page-title">Profiles</h1>
        <KpiGrid items={[
          { label: 'Current profiles', value: profiles.length },
          { label: 'Names in playback', value: perProfile.size, sub: 'includes historical profiles' },
          { label: 'Most active', value: ranked[0]?.[0] ?? '—' },
          { label: 'Autoplay on', value: `${autoplayOn} of ${profiles.length}` },
        ]} />
      </div>
      <InsightsCard items={insights} />
      {viewing.length > 0 && trendSeries.length > 0 && (
        <TimeChart title="Sessions over time by profile" data={trend} series={trendSeries} />
      )}
      <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((row, i) => (
          <Card key={i} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="title-md">{row['Profile Name'] || 'Unnamed'}</span>
              <span className="caption-mono">{row['Maturity Level']}</span>
            </div>
            <p className="font-body text-base text-subtle">Created {fmtDate(row['Profile Creation Time'])}</p>
            <dl className="mt-2 space-y-2 font-body text-base">
              <div className="flex justify-between border-b border-line pb-2"><dt className="text-subtle">Language</dt><dd>{row['Primary Lang'] || '—'}</dd></div>
              <div className="flex justify-between border-b border-line pb-2"><dt className="text-subtle">Max stream quality</dt><dd>{row['Max Stream Quality'] || '—'}</dd></div>
              <div className="flex justify-between border-b border-line pb-2"><dt className="text-subtle">Autoplay</dt><dd>{row['Has Auto Playback'] === '1' ? 'On' : 'Off'}</dd></div>
              <div className="flex justify-between border-b border-line pb-2"><dt className="text-subtle">Profile lock</dt><dd>{row['Profile Lock Enabled'] === 'true' ? 'On' : 'Off'}</dd></div>
              <div className="flex justify-between"><dt className="text-subtle">Playback records</dt><dd className="tabular-nums">{(perProfile.get(row['Profile Name']) ?? 0).toLocaleString()}</dd></div>
            </dl>
          </Card>
        ))}
      </div>
      {viewing.length > 0 && (
        <Card>
          <SectionTitle>All profile names seen in playback records</SectionTitle>
          <BarList data={topN(viewing, (row) => row['Profile Name'], 15)} unit=" plays" title="Profiles ranked by plays" />
        </Card>
      )}
    </div>
  )
}
