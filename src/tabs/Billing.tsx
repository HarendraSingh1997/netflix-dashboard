
import { usePending, useRows } from '../lib/store'
import { fmtDate, fmtNum, minMax, parseTs, settledInvoices, totalsByCurrency } from '../lib/utils'
import { monthlySeries } from '../lib/analytics'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, Table, TabSkeleton } from '../components/ui'
import TimeChart from '../components/TimeChart'

export default function Billing() {
  const billing = useRows('BillingHistory.csv')
  const subscription = useRows('SubscriptionHistory.csv')
  const pending = usePending('BillingHistory.csv', 'SubscriptionHistory.csv')
  const invoices = settledInvoices(billing)
  const totals = totalsByCurrency(billing)
  const methods = (() => {
    const methodCounts = new Map<string, number>()
    for (const row of invoices) {
      const key = row['Payment Type'] ? `${row['Payment Type']} ····${row['Mop Last 4']}` : row['Mop Pmt Processor Desc'] || 'Unknown'
      methodCounts.set(key, (methodCounts.get(key) ?? 0) + 1)
    }
    return [...methodCounts.entries()].sort((a, b) => b[1] - a[1])
  })()
  const recent = [...invoices].sort((a, b) => (b['Transaction Date'] ?? '').localeCompare(a['Transaction Date'] ?? ''))
  const trend = monthlySeries(invoices, 'Transaction Date', {
    value: (row) => Number(row['Gross Sale Amt']) || 0,
  }).map((d) => ({ month: d.month, paid: Math.round(Number(d.value)) }))

  const insights = (() => {
    const out: string[] = []
    const amounts = invoices.map((row) => Number(row['Gross Sale Amt']) || 0).filter((n) => n > 0)
    if (amounts.length) {
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
      out.push(`The average settled invoice is ${recent[0]?.Currency ?? ''} ${Math.round(avg).toLocaleString()} across ${amounts.length} invoices.`)
    }
    if (recent[0]) out.push(`Latest charge: ${recent[0].Currency} ${recent[0]['Gross Sale Amt']} on ${fmtDate(recent[0]['Transaction Date'])}, covering ${fmtDate(recent[0]['Service Period Start Date'])} to ${fmtDate(recent[0]['Service Period End Date'])}.`)
    if (methods[0]) out.push(`Most-used payment method: ${methods[0][0]} (${methods[0][1]} invoices).`)
    const times: number[] = []
    for (const row of invoices) {
      const d = parseTs(row['Transaction Date'])
      if (d) times.push(d.getTime())
    }
    if (times.length > 1) {
      const { min, max } = minMax(times)
      const months = Math.max(1, Math.round((max - min) / 86400000 / 30.4))
      out.push(`Billing history covers about ${months} months of continuous membership.`)
    }
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={1} cards={2} table />
  if (!billing.length && !subscription.length) return <Empty label="No billing data in this export" />

  return (
    <div className="space-y-[120px]">
      <div className="space-y-6">
        <h1 className="page-title">Billing</h1>
        <KpiGrid items={[
          { label: 'Settled invoices', value: invoices.length.toLocaleString() },
          { label: 'Total paid', value: totals.map((t) => `${t.name} ${fmtNum(t.value)}`).join(' / ') || '—', sub: 'subscription invoices only' },
          { label: 'Latest invoice', value: recent[0] ? fmtDate(recent[0]['Transaction Date']) : '—', sub: recent[0] ? `${recent[0].Currency} ${recent[0]['Gross Sale Amt']}` : undefined },
          { label: 'Payment methods', value: methods.length },
        ]} />
      </div>
      <InsightsCard items={insights} />
      {invoices.length > 0 && (
        <TimeChart title="Spend over time" data={trend} series={[{ key: 'paid', label: 'Paid' }]} />
      )}
      {methods.length > 0 && (
        <Card>
          <SectionTitle>Payment methods used</SectionTitle>
          <BarList data={methods.map(([name, value]) => ({ name, value }))} unit=" invoices" title="Methods ranked by invoices" />
        </Card>
      )}
      {subscription.length > 0 && (
        <Card>
          <SectionTitle>Subscription periods</SectionTitle>
          <Table rows={subscription} />
        </Card>
      )}
      {recent.length > 0 && (
        <Card>
          <SectionTitle>All invoices</SectionTitle>
          <Table rows={invoices} />
        </Card>
      )}
    </div>
  )
}
