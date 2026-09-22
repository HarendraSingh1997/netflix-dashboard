
import { usePending, useRows } from '../lib/store'
import { fmtDate, parseTs, topN } from '../lib/utils'
import { monthlySeries } from '../lib/analytics'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, Table, TabSkeleton } from '../components/ui'
import TimeChart from '../components/TimeChart'

export default function Messages() {
  const messages = useRows('MessagesSentByNetflix.csv')
  const chats = useRows('ChatTranscripts.csv')
  const contacts = useRows('CSContact.csv')
  const pending = usePending('MessagesSentByNetflix.csv', 'ChatTranscripts.csv', 'CSContact.csv')

  const types = topN(messages, (row) => row['Message Name'], 10)
  const channels = topN(messages, (row) => row['Channel'], 5)
  const recent = [...messages].sort((a, b) => (b['Sent Utc Ts'] ?? '').localeCompare(a['Sent Utc Ts'] ?? ''))
  const trend = monthlySeries(messages, 'Sent Utc Ts', { groupField: 'Channel', topGroups: 3 })
  const trendSeries = (() => {
    const keys = new Set<string>()
    for (const d of trend) for (const k of Object.keys(d)) if (k !== 'month') keys.add(k)
    return [...keys].map((k) => ({ key: k, label: k || 'Unknown' }))
  })()

  const insights = (() => {
    const out: string[] = []
    if (types[0] && messages.length) out.push(`“${types[0].name}” is the most frequent message at ${types[0].value.toLocaleString()} sends (${Math.round(types[0].value / messages.length * 100)}% of all messages).`)
    if (channels.length > 1) out.push(`Messages arrive via ${channels.map((c) => `${c.name} (${c.value.toLocaleString()})`).join(', ')}.`)
    else if (channels[0]) out.push(`All messages arrive via a single channel: ${channels[0].name}.`)
    if (contacts.length) {
      const durations: number[] = []
      for (const row of contacts) {
        const a = parseTs(row['Contact Start Utc Ts'])
        const b = parseTs(row['Contact End Utc Ts'])
        if (a && b && b.getTime() >= a.getTime()) durations.push((b.getTime() - a.getTime()) / 60000)
      }
      if (durations.length) out.push(`Support contacts average ${Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)} minutes each.`)
      const last = [...contacts].sort((a, b) => (b['Contact Start Utc Ts'] ?? '').localeCompare(a['Contact Start Utc Ts'] ?? ''))[0]
      if (last) out.push(`Most recent support contact: ${fmtDate(last['Contact Start Utc Ts'])} (${last['End State'] || 'no recorded outcome'}).`)
    }
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={1} cards={2} columns={2} table />
  if (!messages.length && !chats.length && !contacts.length) return <Empty label="No messages or support data in this export" />

  return (
    <div className="space-y-[120px]">
      <div className="space-y-6">
        <h1 className="page-title">Messages &amp; support</h1>
        <KpiGrid items={[
          { label: 'Messages from Netflix', value: messages.length.toLocaleString() },
          { label: 'Support contacts', value: contacts.length },
          { label: 'Chat transcripts', value: chats.length },
          { label: 'Message types', value: new Set(messages.map((row) => row['Message Name'])).size },
        ]} />
      </div>
      <InsightsCard items={insights} />
      {messages.length > 0 && trendSeries.length > 0 && (
        <TimeChart title="Messages over time by channel" data={trend} series={trendSeries} />
      )}
      <div className="grid lg:grid-cols-2 gap-10">
        {types.length > 0 && (
          <Card>
            <SectionTitle>Most frequent messages</SectionTitle>
            <BarList data={types} unit=" sent" title="Messages ranked by sends" />
          </Card>
        )}
        {channels.length > 0 && (
          <Card>
            <SectionTitle>By channel</SectionTitle>
            <BarList data={channels} unit=" sent" title="Channels ranked by sends" />
          </Card>
        )}
      </div>
      {contacts.length > 0 && (
        <Card>
          <SectionTitle>Support contacts</SectionTitle>
          <Table rows={contacts} />
        </Card>
      )}
      {recent.length > 0 && (
        <Card>
          <SectionTitle>All messages</SectionTitle>
          <Table rows={recent} />
          <p className="mt-6 font-body text-base text-subtle">Full message contents are not included in this export; all {messages.length} records are listed above with sorting and filtering.</p>
        </Card>
      )}
    </div>
  )
}
