import { describe, expect, it } from 'vitest'
import { topN } from './utils'

const rows = (names: string[]) => names.map((name) => ({ name }))

describe('topN', () => {
  it('respects the limit and stays value-descending', () => {
    const items = rows(['b', 'a', 'b', 'c', 'a', 'a', 'a', 'd', 'e', 'b'])
    expect(topN(items, (r) => r.name, 2)).toEqual([
      { name: 'a', value: 4 },
      { name: 'b', value: 3 },
    ])
  })

  it('returns everything in pre-fix order when no limit is given', () => {
    const items = rows(['b', 'a', 'b'])
    expect(topN(items, (r) => r.name)).toEqual([
      { name: 'b', value: 2 },
      { name: 'a', value: 1 },
    ])
  })

  it('excludes falsy keys from counting', () => {
    const items = rows(['a', '', 'a', ''])
    expect(topN(items, (r) => r.name)).toEqual([{ name: 'a', value: 2 }])
  })

  it('returns [] for empty input', () => {
    expect(topN([], (r: { name: string }) => r.name, 10)).toEqual([])
  })

  it('returns [] for count 0 and everything for oversized counts', () => {
    const items = rows(['a', 'b'])
    expect(topN(items, (r) => r.name, 0)).toEqual([])
    expect(topN(items, (r) => r.name, 99)).toHaveLength(2)
  })

  it('keeps first-seen order on ties', () => {
    const items = rows(['y', 'x', 'y', 'x'])
    expect(topN(items, (r) => r.name)).toEqual([
      { name: 'y', value: 2 },
      { name: 'x', value: 2 },
    ])
  })
})
