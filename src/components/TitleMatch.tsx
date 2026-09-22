import { useState } from 'react'
import { useApp, useRows } from '../lib/store'
import { countTitles, matchStats } from '../lib/title-match'
import { Card, SectionTitle } from './ui'
import { Button } from './ui/button'
import { Input } from './ui/input'
import DataGrid from './DataGrid'

const KEY_STORAGE = 'typesafe-api-key'

function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? import.meta.env.VITE_TYPESAFE_API_KEY ?? ''
  } catch {
    return ''
  }
}

/** Opt-in AI title matching. Nothing runs without the user's own key, and the
 *  only data that leaves the browser is title strings sent to TypeSafe. */
export default function TitleMatch() {
  const runTitleMatch = useApp((s) => s.runTitleMatch)
  const match = useApp((s) => s.titleMatch)
  const viewing = useRows('ViewingActivity.csv')
  const search = useRows('SearchHistory.csv')
  const [apiKey, setApiKey] = useState(loadKey)
  const matching = match.status === 'matching'

  function saveKey(value: string) {
    setApiKey(value)
    try {
      if (value) localStorage.setItem(KEY_STORAGE, value)
      else localStorage.removeItem(KEY_STORAGE)
    } catch {
      /* private mode */
    }
  }

  async function run() {
    if (!apiKey.trim() || matching) return
    await runTitleMatch(apiKey.trim())
  }

  const canonical = new Map(Object.entries(match.canonical))
  const stats =
    match.status === 'ready' || match.status === 'error'
      ? matchStats(
          canonical,
          countTitles(viewing, 'Title'),
          countTitles(
            search.filter((row) => (row['Action'] || '').toLowerCase() === 'play'),
            'Displayed Name',
          ),
        ).filter((row) => row.searchPlays > 0)
      : []
  const matchedSessions = stats.reduce((sum, row) => sum + row.viewingSessions, 0)

  return (
    <Card>
      <SectionTitle>AI title matching</SectionTitle>
      <p className="font-body text-base leading-relaxed text-subtle">
        Exact text rarely lines up across files (“Show: Season 1” vs “Show”), so
        plays from search stay undercounted. With your TypeSafe API key, Jev judges
        candidate title pairs and merges true matches. Only title strings leave this
        browser — counts and profiles never do. The key stays in local storage.
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-6">
        <div className="grid gap-2">
          <span className="caption-mono">TypeSafe API key</span>
          <Input
            type="password"
            aria-label="TypeSafe API key"
            placeholder="Paste key to enable matching…"
            value={apiKey}
            onChange={(event) => saveKey(event.target.value)}
            className="border-0 border-b border-rule bg-transparent px-0 font-body text-base placeholder:text-faint focus-visible:border-ink focus-visible:ring-0 w-64"
          />
        </div>
        <Button variant="bugatti" size="pill-sm" onClick={() => void run()} disabled={!apiKey.trim() || matching}>
          {matching ? `Judging ${match.judged} of ${match.total}…` : match.status === 'ready' ? 'Re-run matching' : 'Match titles'}
        </Button>
      </div>
      {matching && (
        <p role="status" className="mt-6 font-body text-base text-subtle">
          Judging title pair {match.judged + 1} of {match.total}…
        </p>
      )}
      {match.status === 'error' && match.error && (
        <p role="alert" className="mt-6 font-body text-base text-warning">
          {match.error} — {match.judged} of {match.total} pairs judged; partial results below.
        </p>
      )}
      {(match.status === 'ready' || (match.status === 'error' && (match.merged > 0 || stats.length > 0))) && (
        <div className="mt-6 space-y-6">
          <p className="font-body text-base text-body">
            Merged {match.merged} variant {match.merged === 1 ? 'title' : 'titles'}, attributing{' '}
            {matchedSessions.toLocaleString()} viewing sessions to searched titles.
            {match.related.length > 0 && (
              <> {match.related.length} related {match.related.length === 1 ? 'pair was' : 'pairs were'} left unmerged for review.</>
            )}
          </p>
          {stats.length > 0 && (
            <DataGrid
              rows={stats.map((row) => ({
                Title: row.title,
                'Search plays': row.searchPlays.toLocaleString(),
                'Viewing sessions': row.viewingSessions.toLocaleString(),
              }))}
            />
          )}
          {match.related.length > 0 && (
            <div>
              <p className="caption-mono mb-4">Related, left unmerged</p>
              <ul className="space-y-3">
                {match.related.map((pair, i) => (
                  <li key={i} className="font-body text-base text-subtle">
                    “{pair.a}” ↔ “{pair.b}” — disagreeing on{' '}
                    {pair.sameBase <= pair.sameScope ? 'base show' : 'scope'}
                    {pair.confidence < 0.5 ? ' (low confidence)' : ''}.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
