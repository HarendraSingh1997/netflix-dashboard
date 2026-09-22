import { describe, expect, it } from 'vitest'
import { monthlyViewing, overviewTrend, peakMonth } from './analytics'
import type { Row } from './store'

const row = (start: string, duration: string): Row => ({ 'Start Time': start, Duration: duration })

// January: 10 short rows (10 x 36s = 360s). February: 2 long rows (2 x 3600s).
const viewing: Row[] = [
  ...Array.from({ length: 10 }, (_, i) => row(`2024-01-${String(i + 1).padStart(2, '0')} 10:00:00`, '0:36')),
  row('2024-02-01 10:00:00', '1:00:00'),
  row('2024-02-02 10:00:00', '1:00:00'),
]

describe('overviewTrend', () => {
  it('sums durations per month instead of counting rows', () => {
    expect(overviewTrend(viewing)).toEqual([
      { month: '2024-01', hours: 0.1 },
      { month: '2024-02', hours: 2 },
    ])
  })

  it('returns [] for empty input', () => {
    expect(overviewTrend([])).toEqual([])
  })

  it('agrees with monthlyViewing totals', () => {
    const expected = new Map(monthlyViewing(viewing).map((d) => [d.month, d.hours]))
    for (const point of overviewTrend(viewing)) {
      expect(point.hours).toBeCloseTo(expected.get(point.month) ?? -1, 1)
    }
  })
})

describe('peakMonth', () => {
  it('picks the max-hours month even when another month has more rows', () => {
    expect(peakMonth(overviewTrend(viewing))?.month).toBe('2024-02')
  })

  it('returns undefined for an empty trend', () => {
    expect(peakMonth([])).toBeUndefined()
  })
})
