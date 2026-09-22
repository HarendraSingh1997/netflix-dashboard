import { describe, expect, it } from 'vitest'
import { buildGraph, candidateShows, connections, lookupShow, type GraphInput } from './graph'

const input: GraphInput = {
  viewing: [
    { Title: 'Show: Season 1', 'Profile Name': 'A', 'Device Type': 'TV', Country: 'IN (India)' },
    { Title: 'Show: Season 2', 'Profile Name': 'B', 'Device Type': 'TV', Country: 'IN (India)' },
    { Title: 'Other', 'Profile Name': 'A', 'Device Type': 'Phone', Country: '' },
  ],
  searches: [
    { 'Displayed Name': 'Show', Action: 'play' },
    { Displayed: '', Action: '' } as unknown as { [k: string]: string },
  ],
  ratings: [{ 'Title Name': 'Show' }],
  mylist: [{ 'Title Name': 'Other' }],
  streaming: [{ 'Region Code Display Name': 'Karnataka' }],
  logins: [{ 'Region Code': 'DL' }],
}

describe('buildGraph', () => {
  it('merges season variants into one canonical show node', () => {
    const g = buildGraph(input)
    expect(g.shows.get('show')).toMatchObject({ sessions: 2, plays: 1, ratings: 1, onList: false })
    expect(g.shows.get('show')?.profiles.sort()).toEqual(['A', 'B'])
    expect(g.shows.get('other')).toMatchObject({ sessions: 1, onList: true })
    expect(g.profiles).toEqual(['A', 'B'])
  })

  it('keeps per-show country regions and an account footprint', () => {
    const g = buildGraph(input)
    expect(g.shows.get('show')?.regions).toEqual(['IN (India)'])
    expect(g.regions).toEqual(expect.arrayContaining(['DL', 'IN (India)', 'Karnataka']))
  })

  it('honors a stored canonical map', () => {
    const g = buildGraph(input, new Map([['show', 'The Show']]))
    expect(g.shows.has('The Show')).toBe(true)
    expect(g.shows.has('show')).toBe(false)
  })
})

describe('lookupShow / candidateShows / connections', () => {
  it('finds shows case-insensitively', () => {
    const g = buildGraph(input)
    expect(lookupShow(g, 'SHOW')?.sessions).toBe(2)
    expect(lookupShow(g, 'Missing')).toBeUndefined()
  })

  it('ranks token-overlapping candidates', () => {
    const g = buildGraph(input)
    expect(candidateShows(g, 'show season')[0]).toBe('show')
    expect(candidateShows(g, 'zzz')).toEqual([])
  })

  it('reports shared profiles and devices', () => {
    const g = buildGraph(input)
    expect(connections(g, 'Show', 'Other')).toEqual({ profiles: ['A'], devices: [], regions: [] })
    expect(connections(g, 'Show', 'Missing')).toBeUndefined()
  })
})
