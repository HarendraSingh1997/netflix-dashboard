import { describe, expect, it } from 'vitest'
import { buildGraph } from './graph'
import { DATASETS, TOOLS, type ToolContext } from './tools'

const rows: Record<string, Record<string, string>[]> = {
  'ViewingActivity.csv': [
    { Title: 'Show: Season 1', 'Profile Name': 'A', 'Device Type': 'TV', 'Start Time': '2024-01-05 10:00:00', Duration: '1:00:00', Country: 'IN' },
    { Title: 'Show: Season 2', 'Profile Name': 'A', 'Device Type': 'TV', 'Start Time': '2024-02-05 10:00:00', Duration: '0:30:00', Country: 'IN' },
    { Title: 'Other', 'Profile Name': 'B', 'Device Type': 'Phone', 'Start Time': '2024-02-06 10:00:00', Duration: '0:10:00', Country: '' },
  ],
  'SearchHistory.csv': [
    { 'Displayed Name': 'Show', Action: 'play', 'Profile Name': 'A', 'Utc Timestamp': '2024-01-01 10:00:00' },
  ],
  'Ratings.csv': [],
  'MyList.csv': [],
  'BillingHistory.csv': [],
  'MessagesSentByNetflix.csv': [],
}

const ctx: ToolContext = {
  rows: (file) => rows[file] ?? [],
  graph: buildGraph({
    viewing: rows['ViewingActivity.csv'],
    searches: rows['SearchHistory.csv'],
    ratings: [],
    mylist: [],
    streaming: [],
    logins: [],
  }),
}

describe('ask tools', () => {
  it('topValues ranks and limits', () => {
    const out = TOOLS.topValues.run(ctx, { dataset: 'viewing', field: 'Profile Name', n: 1 })
    expect(out.rows).toEqual([{ Rank: 1, Value: 'A', Count: 2 }])
    expect(out.claim).toContain('A')
  })

  it('filterRows matches case-insensitively and reports totals', () => {
    const out = TOOLS.filterRows.run(ctx, { dataset: 'viewing', field: 'Profile Name', value: 'a' })
    expect(out.claim).toContain('2 of 3')
    expect(out.rows).toHaveLength(2)
  })

  it('monthlyTrend peaks and charts viewing hours', () => {
    const out = TOOLS.monthlyTrend.run(ctx, { dataset: 'viewing' })
    expect(out.claim).toContain('2024-01')
    expect(out.chart?.label).toBe('Hours')
    expect(out.chart?.data).toHaveLength(2)
  })

  it('compareProfiles defaults to viewing', () => {
    const out = TOOLS.compareProfiles.run(ctx, {})
    expect(out.rows[0]).toEqual({ Profile: 'A', Records: 2 })
  })

  it('entityLookup resolves variants and offers candidates on miss', () => {
    const hit = TOOLS.entityLookup.run(ctx, { name: 'Show: Season 1' })
    expect(hit.claim).toContain('2 sessions')
    expect(hit.claim).toContain('1 search plays')
    const miss = TOOLS.entityLookup.run(ctx, { name: 'zzz' })
    expect(miss.rows).toEqual([])
  })

  it('connections reports shared dimensions', () => {
    const out = TOOLS.connections.run(ctx, { a: 'Show', b: 'Other' })
    expect(out.claim).toContain('0 shared profiles')
    const bad = TOOLS.connections.run(ctx, { a: 'Show', b: 'zzz' })
    expect(bad.rows).toEqual([])
  })

  it('listFiles covers every dataset', () => {
    const out = TOOLS.listFiles.run(ctx, {})
    expect(out.rows).toHaveLength(Object.keys(DATASETS).length)
    expect(out.claim).toContain('2 of 6')
  })
})
