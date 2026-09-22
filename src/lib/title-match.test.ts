import { describe, expect, it } from 'vitest'
import {
  candidatePairs,
  canonicalize,
  countTitles,
  groupByNormalized,
  matchStats,
  mergeComponents,
  normalizeTitle,
} from './title-match'

describe('normalizeTitle', () => {
  it('drops season/episode scope suffixes and punctuation', () => {
    expect(normalizeTitle('Stranger Things: Season 4: Chapter One')).toBe('stranger things')
    expect(normalizeTitle('The Office (US)')).toBe('the office us')
    expect(normalizeTitle('  Dark   ')).toBe('dark')
    expect(normalizeTitle('')).toBe('')
  })
})

describe('groupByNormalized', () => {
  it('groups raw variants under one form and skips blanks', () => {
    const groups = groupByNormalized([
      { raw: 'Show: Season 1', count: 5 },
      { raw: 'Show: Season 2', count: 3 },
      { raw: 'Other', count: 1 },
      { raw: '  ', count: 9 },
    ])
    expect(groups.get('show')).toHaveLength(2)
    expect(groups.get('other')).toHaveLength(1)
    expect(groups.has('')).toBe(false)
  })
})

describe('candidatePairs', () => {
  it('pairs overlapping forms and skips disjoint ones, capped by weight', () => {
    const groups = groupByNormalized([
      { raw: 'Stranger Things', count: 50 },
      { raw: 'Stranger Things: Season 4', count: 1 },
      { raw: 'Completely Elsewhere Entirely', count: 100 },
    ])
    // First two share a normalized form (no pair); third is disjoint (no pair).
    expect(candidatePairs(groups)).toEqual([])
  })

  it('pairs token-overlapping distinct forms, highest weight first', () => {
    const groups = groupByNormalized([
      { raw: 'The Office', count: 30 },
      { raw: 'Office Specials', count: 20 },
      { raw: 'Unrelated Bore', count: 1 },
    ])
    const pairs = candidatePairs(groups, 10)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].a).toBe('The Office')
    expect(pairs[0].b).toBe('Office Specials')
  })

  it('respects the cap', () => {
    const groups = groupByNormalized([
      { raw: 'Alpha One', count: 5 },
      { raw: 'Alpha Two', count: 4 },
      { raw: 'Alpha Three', count: 3 },
    ])
    expect(candidatePairs(groups, 1)).toHaveLength(1)
  })
})

describe('mergeComponents + canonicalize', () => {
  it('unions judged pairs and picks the most frequent raw as canonical', () => {
    const groups = groupByNormalized([
      { raw: 'The Office', count: 30 },
      { raw: 'Office Specials', count: 20 },
      { raw: 'Lone Wolf', count: 5 },
    ])
    const canonical = mergeComponents(groups, [['the office', 'office specials']])
    expect(canonicalize(canonical, 'Office Specials')).toBe('The Office')
    expect(canonicalize(canonical, 'Lone Wolf')).toBe('Lone Wolf')
    expect(canonicalize(canonical, 'Never Seen')).toBe('Never Seen')
  })

  it('ignores merges for unknown forms', () => {
    const groups = groupByNormalized([{ raw: 'A', count: 1 }])
    expect(() => mergeComponents(groups, [['a', 'ghost']])).not.toThrow()
  })
})

describe('matchStats', () => {
  it('attributes plays and sessions to canonical titles', () => {
    const canonical = new Map([['show', 'Show']])
    const out = matchStats(
      canonical,
      [
        { raw: 'Show: Season 1', count: 7 },
        { raw: 'Other', count: 2 },
      ],
      [{ raw: 'Show', count: 3 }],
    )
    expect(out).toEqual([
      { title: 'Show', searchPlays: 3, viewingSessions: 7 },
      { title: 'Other', searchPlays: 0, viewingSessions: 2 },
    ])
  })
})

describe('countTitles', () => {
  it('counts non-blank values by field', () => {
    expect(countTitles([{ T: 'a' }, { T: 'a' }, { T: '' }, {}], 'T')).toEqual([{ raw: 'a', count: 2 }])
  })
})
