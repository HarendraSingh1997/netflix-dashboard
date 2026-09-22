/** Cross-file show matching (pure helpers — no API calls here).
 *
 * ViewingActivity `Title` values ("Show: Season 1: Episode") rarely equal
 * SearchHistory `Displayed Name` or Ratings `Title Name` strings exactly, so
 * code first reduces the problem with a cheap rough pass (normalize + token
 * overlap) and leaves the genuine judgment calls to Jev (see `jev.ts`).
 * Only title strings cross files here; counts stay local until merged. */

export interface TitleCount {
  raw: string
  count: number
}

export interface CandidatePair {
  a: string
  b: string
  weight: number
}

const SUFFIX = /[:\-(–—]\s*(season|series|s|part|chapter|episode|ep\.?|volume|vol\.?|limited series|collection)\b.*$/i

/** Normalize for comparison: lowercase, drop season/episode scope suffixes,
 *  keep alphanumerics, collapse whitespace. */
export function normalizeTitle(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(SUFFIX, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokens(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(Boolean))
}

/** Group raw titles by normalized form. Single-raw groups merge for free;
 *  multi-raw groups still merge for free (same normalized show). */
export function groupByNormalized(titles: TitleCount[]): Map<string, TitleCount[]> {
  const groups = new Map<string, TitleCount[]>()
  for (const t of titles) {
    const norm = normalizeTitle(t.raw)
    if (!norm) continue
    const list = groups.get(norm) ?? []
    list.push(t)
    groups.set(norm, list)
  }
  return groups
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared++
  return shared / Math.min(a.size, b.size)
}

function mostFrequent(group: TitleCount[]): string {
  return [...group].sort((x, y) => y.count - x.count)[0].raw
}

/** Candidate cross-form pairs for Jev: distinct normalized forms whose token
 *  sets overlap (containment or >= half shared tokens). Weighted by combined
 *  frequency, capped so API spend follows pairs, not rows. */
export function candidatePairs(groups: Map<string, TitleCount[]>, cap = 40): CandidatePair[] {
  const norms = [...groups.keys()]
  const tokenSets = new Map(norms.map((n) => [n, tokens(n)]))
  const out: CandidatePair[] = []
  const seen = new Set<string>()
  for (let i = 0; i < norms.length; i++) {
    for (let j = i + 1; j < norms.length; j++) {
      const overlapScore = overlap(tokenSets.get(norms[i])!, tokenSets.get(norms[j])!)
      if (overlapScore < 0.5) continue
      const key = norms[i] < norms[j] ? `${norms[i]}|${norms[j]}` : `${norms[j]}|${norms[i]}`
      if (seen.has(key)) continue
      seen.add(key)
      const groupA = groups.get(norms[i])!
      const groupB = groups.get(norms[j])!
      out.push({
        a: mostFrequent(groupA),
        b: mostFrequent(groupB),
        weight:
          groupA.reduce((s, t) => s + t.count, 0) + groupB.reduce((s, t) => s + t.count, 0),
      })
    }
  }
  return out.sort((x, y) => y.weight - x.weight).slice(0, Math.max(0, cap))
}

/** Union normalized forms linked by "same show" judgments. Returns a map of
 *  normalized form -> canonical raw title (most frequent raw in its component). */
export function mergeComponents(
  groups: Map<string, TitleCount[]>,
  merges: [string, string][],
): Map<string, string> {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const root = find(p)
    parent.set(x, root)
    return root
  }
  const union = (x: string, y: string) => parent.set(find(x), find(y))
  for (const [a, b] of merges) {
    if (groups.has(a) && groups.has(b)) union(a, b)
  }
  const members = new Map<string, TitleCount[]>()
  for (const [norm, group] of groups) {
    const root = find(norm)
    members.set(root, [...(members.get(root) ?? []), ...group])
  }
  const canonical = new Map<string, string>()
  for (const norm of groups.keys()) {
    canonical.set(norm, mostFrequent(members.get(find(norm))!))
  }
  return canonical
}

export function canonicalize(canonical: Map<string, string>, raw: string): string {
  return canonical.get(normalizeTitle(raw)) ?? raw
}

export interface MatchedTitle {
  title: string
  searchPlays: number
  viewingSessions: number
}

/** Attribute search plays and viewing sessions to canonical titles. */
export function matchStats(
  canonical: Map<string, string>,
  viewing: TitleCount[],
  plays: TitleCount[],
): MatchedTitle[] {
  const stats = new Map<string, MatchedTitle>()
  const bump = (raw: string, field: 'searchPlays' | 'viewingSessions', count: number) => {
    const title = canonicalize(canonical, raw)
    const entry = stats.get(title) ?? { title, searchPlays: 0, viewingSessions: 0 }
    entry[field] += count
    stats.set(title, entry)
  }
  for (const t of viewing) bump(t.raw, 'viewingSessions', t.count)
  for (const t of plays) bump(t.raw, 'searchPlays', t.count)
  return [...stats.values()].sort((a, b) => b.viewingSessions - a.viewingSessions)
}

/** Count raw title occurrences in rows by field. */
export function countTitles(rows: { [k: string]: string }[], field: string): TitleCount[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const raw = (row[field] || '').trim()
    if (!raw) continue
    counts.set(raw, (counts.get(raw) ?? 0) + 1)
  }
  return [...counts.entries()].map(([raw, count]) => ({ raw, count }))
}
