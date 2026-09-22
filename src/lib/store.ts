import { create } from 'zustand'
import { useEffect } from 'react'
import { parseCsv, type Row } from './utils.ts'
import { judgeTitlePair, MAX_PAIRS } from './jev.ts'
import {
  candidatePairs,
  countTitles,
  groupByNormalized,
  mergeComponents,
  normalizeTitle,
} from './title-match.ts'

export type { Row } from './utils.ts'
export type FileStatus = 'missing' | 'queued' | 'loading' | 'ready' | 'error' | 'document'
export interface FileEntry {
  name: string
  rows: Row[]
  status: FileStatus
  error?: string
}
export type TitleMatchStatus = 'idle' | 'matching' | 'ready' | 'error'
export interface RelatedPair {
  a: string
  b: string
  sameBase: number
  sameScope: number
  confidence: number
}
export interface TitleMatchState {
  status: TitleMatchStatus
  judged: number
  total: number
  merged: number
  related: RelatedPair[]
  /** normalized title -> canonical raw title */
  canonical: Record<string, string>
  error?: string
}
const IDLE_MATCH: TitleMatchState = { status: 'idle', judged: 0, total: 0, merged: 0, related: [], canonical: {} }
export interface AppState {
  loaded: boolean
  accountName: string
  files: Record<string, FileEntry>
  pendingFiles: File[]
  generation: number
  titleMatch: TitleMatchState
  loadFolder: (files: FileList | File[]) => Promise<void>
  ensureFile: (name: string) => Promise<void>
  runTitleMatch: (apiKey: string) => Promise<void>
  reset: () => void
}

const KNOWN = [
  'AccountDetails.csv', 'Profiles.csv', 'SubscriptionHistory.csv', 'ViewingActivity.csv',
  'SearchHistory.csv', 'Clickstream.csv', 'MessagesSentByNetflix.csv', 'PlaybackRelatedEvents.csv',
  'Ratings.csv', 'MyList.csv', 'IndicatedPreferences.csv', 'BillingHistory.csv', 'AccessAndDevices.csv',
  'Devices.csv', 'AvatarHistory.csv', 'ChatTranscripts.csv', 'CSContact.csv', 'GamePlaySession.csv',
  'IpAddressesLogin.csv', 'IpAddressesStreaming.csv', 'IpAddressesAccountCreation.txt',
  'ExtraMembers.txt', 'ParentalControlsRestrictedTitles.txt', 'ProductCancellationSurvey.txt', 'TermsOfUse.csv',
]
const EMPTY: Row[] = []

export const useApp = create<AppState>((set, get) => ({
  loaded: false,
  accountName: '',
  files: {},
  pendingFiles: [],
  titleMatch: IDLE_MATCH,
  generation: 0,
  reset: () => set({ loaded: false, accountName: '', files: {}, pendingFiles: [], titleMatch: IDLE_MATCH, generation: get().generation + 1 }),
  runTitleMatch: async (apiKey: string) => {
    const state = get()
    const generation = state.generation
    const pool = new Map<string, number>()
    const add = (titles: { raw: string; count: number }[]) => {
      for (const t of titles) pool.set(t.raw, (pool.get(t.raw) ?? 0) + t.count)
    }
    add(countTitles(state.files['ViewingActivity.csv']?.rows ?? [], 'Title'))
    add(countTitles(state.files['SearchHistory.csv']?.rows ?? [], 'Displayed Name'))
    add(countTitles(state.files['SearchHistory.csv']?.rows ?? [], 'Query Typed'))
    add(countTitles(state.files['Ratings.csv']?.rows ?? [], 'Title Name'))
    add(countTitles(state.files['MyList.csv']?.rows ?? [], 'Title Name'))
    const groups = groupByNormalized([...pool.entries()].map(([raw, count]) => ({ raw, count })))
    const pairs = candidatePairs(groups, MAX_PAIRS)
    set({ titleMatch: { ...IDLE_MATCH, status: 'matching', total: pairs.length } })
    const merges: [string, string][] = []
    const related: RelatedPair[] = []
    for (const [index, pair] of pairs.entries()) {
      if (get().generation !== generation) return
      try {
        const judgment = await judgeTitlePair(apiKey, pair.a, pair.b)
        if (get().generation !== generation) return
        if (judgment.outcome === 'same') merges.push([normalizeTitle(pair.a), normalizeTitle(pair.b)])
        else if (judgment.outcome === 'related') {
          related.push({ a: pair.a, b: pair.b, sameBase: judgment.sameBase, sameScope: judgment.sameScope, confidence: judgment.confidence })
        }
      } catch (error) {
        if (get().generation !== generation) return
        const canonical = Object.fromEntries(mergeComponents(groups, merges))
        set({
          titleMatch: {
            status: 'error', judged: index, total: pairs.length, merged: merges.length, related,
            canonical, error: error instanceof Error ? error.message : 'Title matching failed',
          },
        })
        return
      }
      set((s) => ({ titleMatch: { ...s.titleMatch, judged: index + 1 } }))
    }
    if (get().generation !== generation) return
    const canonical = Object.fromEntries(mergeComponents(groups, merges))
    set({ titleMatch: { status: 'ready', judged: pairs.length, total: pairs.length, merged: merges.length, related, canonical } })
  },
  loadFolder: async (fileList) => {
    const all = Array.from(fileList)
    if (!all.some((file) => KNOWN.some((name) => name.toLowerCase() === file.name.toLowerCase()))) {
      throw new Error('No Netflix data files found. Select the extracted export folder, not the ZIP file.')
    }
    const generation = get().generation + 1
    const files: Record<string, FileEntry> = Object.fromEntries(KNOWN.map((name) => [name, { name, rows: [], status: 'missing' }]))
    const seen = new Set<string>()
    for (const file of all) {
      if (!/\.(csv|txt|pdf)$/i.test(file.name)) continue
      const key = file.name.toLowerCase()
      if (seen.has(key)) throw new Error('Duplicate filenames found. Import one Netflix export at a time.')
      seen.add(key)
      const name = KNOWN.find((item) => item.toLowerCase() === key) ?? file.name
      files[name] = { name, rows: [], status: /\.pdf$/i.test(name) ? 'document' : 'queued' }
    }
    set({ loaded: true, accountName: '', pendingFiles: all, files, generation })
    await get().ensureFile('AccountDetails.csv')
    if (get().generation !== generation) return
    const account = get().files['AccountDetails.csv']?.rows[0]
    set({ accountName: account?.['First Name'] ?? '' })
  },
  ensureFile: async (name) => {
    const state = get()
    if (state.files[name]?.status !== 'queued') return
    const file = state.pendingFiles.find((item) => item.name.toLowerCase() === name.toLowerCase())
    if (!file) return
    set((s) => ({ files: { ...s.files, [name]: { ...s.files[name], status: 'loading' } } }))
    try {
      const rows = await parseCsv(file)
      if (get().generation !== state.generation) return
      set((s) => ({ files: { ...s.files, [name]: { name, rows, status: 'ready' } } }))
    } catch (error) {
      if (get().generation !== state.generation) return
      set((s) => ({ files: { ...s.files, [name]: { name, rows: [], status: 'error', error: error instanceof Error ? error.message : 'Unable to parse file' } } }))
    }
  },
}))

export function useFile(name: string): FileEntry | undefined {
  const entry = useApp((s) => s.files[name])
  const generation = useApp((s) => s.generation)
  useEffect(() => {
    if (entry?.status === 'queued') void useApp.getState().ensureFile(name)
  }, [name, entry?.status, generation])
  return entry
}

export function useRows(name: string): Row[] {
  return useFile(name)?.rows ?? EMPTY
}

/** True while any of the named files is still waiting to parse (absent, queued, or loading).
 *  Files that settled as missing/error/document count as done, so genuinely absent
 *  files fall through to the existing Empty/error branches instead of skeletoning forever. */
export function usePending(...names: string[]): boolean {
  // Subscribe to a joined status string (not the whole files map) so unrelated
  // file updates don't re-render the tab.
  const key = useApp((s) => names.map((name) => s.files[name]?.status ?? '').join('|'))
  return key.split('|').some((status) => status === '' || status === 'queued' || status === 'loading')
}
