
import { usePending, useRows } from '../lib/store'
import { fmtDate, minMax, parseTs, topN } from '../lib/utils'
import { combinedRegions, monthlySeries } from '../lib/analytics'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, Table, TabSkeleton } from '../components/ui'
import TimeChart from '../components/TimeChart'
import GeoMap from '../components/GeoMap'

export default function Devices() {
  const devices = useRows('Devices.csv')
  const logins = useRows('IpAddressesLogin.csv')
  const streaming = useRows('IpAddressesStreaming.csv')
  const access = useRows('AccessAndDevices.csv')
  const pending = usePending('Devices.csv', 'IpAddressesLogin.csv', 'IpAddressesStreaming.csv', 'AccessAndDevices.csv')

  const deviceStats = (() => {
    const byEsn = new Map<string, { name: string; first: string; last: string }>()
    for (const row of devices) {
      const esn = row['Esn']
      if (!esn) continue
      const name = row['Device Type'] || esn.slice(0, 24)
      const existing = byEsn.get(esn)
      const first = row['Acct First Playback Date'] || existing?.first || ''
      const last = row['Acct Last Playback Date'] || existing?.last || ''
      byEsn.set(esn, { name, first, last })
    }
    return [...byEsn.values()].sort((a, b) => (b.last ?? '').localeCompare(a.last ?? ''))
  })()

  const regions = combinedRegions(streaming, logins)
  const countries = [...new Set([...streaming.map((row) => row['Country']), ...logins.map((row) => row['Country'])].filter(Boolean))]

  const trend = (() => {
    const streamMonths = new Map(monthlySeries(streaming, 'Ts').map((d) => [d.month, Number(d.value)]))
    const loginMonths = new Map(monthlySeries(logins, 'Ts').map((d) => [d.month, Number(d.value)]))
    return [...new Set([...streamMonths.keys(), ...loginMonths.keys()])].sort().map((month) => ({
      month,
      streaming: streamMonths.get(month) ?? 0,
      logins: loginMonths.get(month) ?? 0,
    }))
  })()

  const insights = (() => {
    const out: string[] = []
    const topRegion = topN(streaming, (row) => row['Region Code Display Name'])[0]
    if (topRegion && streaming.length) out.push(`${topRegion.name} accounts for ${topRegion.value.toLocaleString()} streaming events — ${Math.round(topRegion.value / streaming.length * 100)}% of the total.`)
    if (countries.length > 1) out.push(`Activity spans ${countries.length} countries (${countries.join(', ')}), with India dominant.`)
    else if (countries.length === 1) out.push(`All IP-logged activity is domestic (${countries[0]}), apart from region naming.`)
    const household = access.filter((row) => row['Part Of Netflix Household'] === 'Yes').length
    if (access.length) out.push(`${household} of ${access.length} recent access records are part of the Netflix household.`)
    const times: number[] = []
    for (const row of [...streaming, ...logins]) {
      const d = parseTs(row['Ts'])
      if (d) times.push(d.getTime())
    }
    if (times.length > 1) {
      const { min, max } = minMax(times)
      out.push(`Location logs run from ${fmtDate(new Date(min).toISOString().slice(0, 10))} to ${fmtDate(new Date(max).toISOString().slice(0, 10))}.`)
    }
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={2} cards={1} table />
  if (!devices.length && !logins.length && !streaming.length) return <Empty label="No device or location data in this export" />

  return (
    <div className="space-y-[120px]">
      <div className="space-y-6">
        <h1 className="page-title">Devices &amp; locations</h1>
        <KpiGrid items={[
          { label: 'Devices', value: deviceStats.length.toLocaleString(), sub: 'unique device identifiers' },
          { label: 'Streaming events', value: streaming.length.toLocaleString() },
          { label: 'Login events', value: logins.length.toLocaleString() },
          { label: 'Countries', value: countries.length, sub: 'seen in IP logs' },
        ]} />
      </div>
      <InsightsCard items={insights} />
      {(streaming.length > 0 || logins.length > 0) && (
        <TimeChart title="Access events over time" data={trend} series={[{ key: 'streaming', label: 'Streaming' }, { key: 'logins', label: 'Logins' }]} />
      )}
      {(streaming.length > 0 || logins.length > 0) && (
        <GeoMap
          indian={[
            { rows: streaming, match: (row) => row['Region Code Display Name'] },
            { rows: logins, match: (row) => row['Region Code'] },
          ]}
          outside={[]}
        />
      )}
      {regions.length > 0 && (
        <Card>
          <SectionTitle>Activity by region</SectionTitle>
          <BarList data={regions} unit=" events" title="Regions ranked by events" />
        </Card>
      )}
      {deviceStats.length > 0 && (
        <Card>
          <SectionTitle>Device fleet (all devices, sortable)</SectionTitle>
          <Table
            rows={deviceStats.map((d) => ({ Device: d.name, 'First seen': fmtDate(d.first), 'Last seen': fmtDate(d.last) }))}
            cols={['Device', 'First seen', 'Last seen']}
          />
        </Card>
      )}
      {access.length > 0 && (
        <Card>
          <SectionTitle>All account access</SectionTitle>
          <Table
            rows={[...access].reverse().map((row) => ({
              Date: fmtDate(row['Date']), Devices: row['Devices'] || '—', 'In household': row['Part Of Netflix Household'] || '—',
            }))}
            cols={['Date', 'Devices', 'In household']}
          />
        </Card>
      )}
    </div>
  )
}
