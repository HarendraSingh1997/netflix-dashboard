/** Knowledge graph over the export, built entirely in code.
 *
 * Nodes are canonical shows, profiles, devices, and regions; edges carry
 * counts (watched sessions, search plays, ratings, streams, logins).
 * Entity resolution reuses `normalizeTitle` (plus stored Jev merges when the
 * caller passes them). No API calls here — Jev only disambiguates names at
 * query time via the dispatcher/tools layer. */

import { canonicalize, normalizeTitle } from '../title-match'

export interface ShowNode {
  title: string
  profiles: string[]
  devices: string[]
  regions: string[]
  sessions: number
  plays: number
  ratings: number
  onList: boolean
}

export interface Graph {
  shows: Map<string, ShowNode>
  profiles: string[]
  /** Account-level region footprint (IP logs + viewing countries). */
  regions: string[]
}

export interface GraphInput {
  viewing: { [k: string]: string }[]
  searches: { [k: string]: string }[]
  ratings: { [k: string]: string }[]
  mylist: { [k: string]: string }[]
  streaming: { [k: string]: string }[]
  logins: { [k: string]: string }[]
}

function nameOf(row: { [k: string]: string }, fields: string[]): string {
  for (const f of fields) {
    const v = (row[f] || '').trim()
    if (v) return v
  }
  return ''
}

export function buildGraph(input: GraphInput, canonical?: Map<string, string>): Graph {
  const canon = (raw: string) => (canonical ? canonicalize(canonical, raw) : normalizeTitle(raw) || raw)
  const shows = new Map<string, ShowNode>()
  const profiles = new Set<string>()
  const node = (title: string): ShowNode => {
    let n = shows.get(title)
    if (!n) {
      n = { title, profiles: [], devices: [], regions: [], sessions: 0, plays: 0, ratings: 0, onList: false }
      shows.set(title, n)
    }
    return n
  }
  const addUnique = (list: string[], value: string) => {
    const v = value.trim()
    if (v && !list.includes(v)) list.push(v)
  }

  for (const row of input.viewing) {
    const raw = nameOf(row, ['Title'])
    if (!raw) continue
    const n = node(canon(raw))
    n.sessions++
    addUnique(n.profiles, row['Profile Name'] || '')
    addUnique(n.devices, row['Device Type'] || '')
    const profile = (row['Profile Name'] || '').trim()
    if (profile) profiles.add(profile)
  }
  for (const row of input.searches) {
    const action = (row['Action'] || '').toLowerCase()
    if (action !== 'play' && action !== 'select') continue
    const raw = nameOf(row, ['Displayed Name'])
    if (!raw) continue
    const n = node(canon(raw))
    if (action === 'play') n.plays++
  }
  for (const row of input.ratings) {
    const raw = nameOf(row, ['Title Name'])
    if (!raw) continue
    node(canon(raw)).ratings++
  }
  for (const row of input.mylist) {
    const raw = nameOf(row, ['Title Name'])
    if (!raw) continue
    node(canon(raw)).onList = true
  }
  for (const row of input.viewing) {
    const raw = nameOf(row, ['Title'])
    if (!raw || !row['Country']?.trim()) continue
    addUnique(node(canon(raw)).regions, row['Country'])
  }
  const footprint = new Set<string>()
  const regionOf = (row: { [k: string]: string }) =>
    (row['Region Code Display Name'] || row['Region Code'] || '').trim()
  for (const row of [...input.streaming, ...input.logins]) {
    const region = regionOf(row)
    if (region) footprint.add(region)
  }
  for (const row of input.viewing) {
    if (row['Country']?.trim()) footprint.add(row['Country'].trim())
  }
  return { shows, profiles: [...profiles].sort(), regions: [...footprint].sort() }
}

export function lookupShow(graph: Graph, name: string): ShowNode | undefined {
  const norm = normalizeTitle(name)
  for (const [key, node] of graph.shows) {
    if (normalizeTitle(key) === norm || key.toLowerCase() === name.trim().toLowerCase()) return node
  }
  return undefined
}

/** Candidate show titles containing the query's tokens (for Jev disambiguation). */
export function candidateShows(graph: Graph, query: string, cap = 6): string[] {
  const tokens = new Set(normalizeTitle(query).split(' ').filter(Boolean))
  if (!tokens.size) return []
  const scored: { title: string; score: number }[] = []
  for (const title of graph.shows.keys()) {
    const titleTokens = new Set(normalizeTitle(title).split(' ').filter(Boolean))
    let shared = 0
    for (const t of tokens) if (titleTokens.has(t)) shared++
    if (shared > 0) scored.push({ title, score: shared / Math.min(tokens.size, titleTokens.size || 1) })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, Math.max(0, cap))
    .map((s) => s.title)
}

/** What connects two shows: shared profiles, devices, regions. */
export function connections(
  graph: Graph,
  a: string,
  b: string,
): { profiles: string[]; devices: string[]; regions: string[] } | undefined {
  const nodeA = lookupShow(graph, a)
  const nodeB = lookupShow(graph, b)
  if (!nodeA || !nodeB) return undefined
  const shared = (x: string[], y: string[]) => x.filter((v) => y.includes(v))
  return {
    profiles: shared(nodeA.profiles, nodeB.profiles),
    devices: shared(nodeA.devices, nodeB.devices),
    regions: shared(nodeA.regions, nodeB.regions),
  }
}
