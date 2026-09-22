
import { usePending, useRows } from '../lib/store'
import { Card, InsightsCard, KpiGrid, SectionTitle, TabSkeleton } from '../components/ui'
import { SourcePanel } from '../components/Explorer'
import TimeChart from '../components/TimeChart'
import { monthlySeries } from '../lib/analytics'
import { fmtDate, topN } from '../lib/utils'

export default function Account() {
  const account = useRows('AccountDetails.csv')[0]
  const terms = useRows('TermsOfUse.csv')
  const pending = usePending('AccountDetails.csv', 'TermsOfUse.csv')
  const preferences = Object.entries(account ?? {}).filter(([key]) => /\(Email\)|\(Push Notification\)|Opt-out|Setting|Participation/.test(key))
  const enabled = (() => {
    let count = 0
    for (const [, v] of preferences) if (/^(YES|TRUE|ENABLED)$/i.test((v ?? '').trim())) count++
    return count
  })()
  const trend = monthlySeries(terms, 'Tou Accepted Date').map((d) => ({ month: d.month, acceptances: Number(d.value) }))

  const latestTou = topN(terms, (row) => row['Tou Accepted Date'])[0]?.name ?? ''
  const insights = [
    `Membership status is ${account?.['Membership Status'] || 'unknown'}, created ${fmtDate(account?.['Customer Creation Timestamp'])} in ${account?.['Country Of Signup'] || 'an unknown country'}.`,
    `${enabled} of ${preferences.length} communication and privacy preferences are switched on.`,
    ...(terms.length ? [`Terms of use accepted ${terms.length} times — most recently ${fmtDate(latestTou)}.`] : []),
  ].slice(0, 4)

  if (pending) return <TabSkeleton charts={1} cards={1} />

  return <div className="space-y-[120px]">
    <div className="space-y-6">
      <h1 className="page-title">Account</h1>
      <KpiGrid items={[
        { label: 'Membership status', value: account?.['Membership Status'] || '—' },
        { label: 'Account created', value: fmtDate(account?.['Customer Creation Timestamp']) },
        { label: 'Primary language', value: account?.['Primary Lang'] || '—' },
        { label: 'Preferences enabled', value: `${enabled} of ${preferences.length}` },
      ]} />
    </div>
    <InsightsCard items={insights} />
    {terms.length > 0 && (
      <TimeChart title="Terms acceptances over time" data={trend} series={[{ key: 'acceptances', label: 'Acceptances' }]} />
    )}
    <Card><SectionTitle>Communication & privacy preferences</SectionTitle><dl className="grid gap-4 sm:grid-cols-2">{preferences.map(([key, value]) => <div key={key} className="border-b border-line pb-3"><dt className="caption-mono">{key}</dt><dd className="mt-2 font-body text-base">{value || 'Not specified'}</dd></div>)}</dl></Card>
    <div className="space-y-6">
      <p className="font-body text-base text-subtle">Personal details are hidden until you open the raw account record. Values reflect the export, not live account settings.</p>
      <SourcePanel name="AccountDetails.csv" title="Reveal raw account details" />
      <SourcePanel name="TermsOfUse.csv" />
      <SourcePanel name="ExtraMembers.txt" />
      <SourcePanel name="ProductCancellationSurvey.txt" />
    </div>
  </div>
}
