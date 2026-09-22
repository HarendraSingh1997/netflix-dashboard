import { useState } from 'react'
import { useApp } from '../lib/store'
import { topN } from '../lib/utils'
import { answerQuestion, runAgent, type AskAnswer } from '../lib/ask/answer'
import { buildGraph, candidateShows } from '../lib/ask/graph'
import { DATASETS, type DatasetId } from '../lib/ask/tools'
import { Card, SectionTitle } from '../components/ui'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import DataGrid from '../components/DataGrid'
import TimeChart from '../components/TimeChart'

const KEY_STORAGE = 'typesafe-api-key'
const GRAPH_FILES = [
  'ViewingActivity.csv',
  'SearchHistory.csv',
  'Ratings.csv',
  'MyList.csv',
  'IpAddressesStreaming.csv',
  'IpAddressesLogin.csv',
]

const EXAMPLES = [
  'Which profile watches the most?',
  'When is my peak viewing month?',
  'What show have I watched the most?',
]

function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? import.meta.env.VITE_TYPESAFE_API_KEY ?? ''
  } catch {
    return ''
  }
}

function verdictLabel(verdict: AskAnswer['claims'][number]['verdict']): string {
  if (verdict === 'supported') return 'supported'
  if (verdict === 'flagged') return 'needs review'
  return 'unchecked'
}

export default function Ask() {
  const titleMatch = useApp((s) => s.titleMatch)
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<'rag' | 'agent'>('rag')
  const [apiKey, setApiKey] = useState(loadKey)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState<AskAnswer | null>(null)

  async function run() {
    const key = apiKey.trim()
    const q = question.trim()
    if (!key || !q || busy) return
    try {
      localStorage.setItem(KEY_STORAGE, key)
    } catch {
      /* private mode */
    }
    setBusy(true)
    setError('')
    setAnswer(null)
    const generation = useApp.getState().generation
    try {
      const state = useApp.getState()
      for (const file of GRAPH_FILES) {
        setNote(`Preparing ${file.replace(/\.(csv|txt)$/i, '')}…`)
        await state.ensureFile(file)
        if (useApp.getState().generation !== generation) return
      }
      const at = () => useApp.getState()
      const rowsOf = (file: string) => at().files[file]?.rows ?? []
      const canonical =
        titleMatch.status === 'ready' || titleMatch.status === 'error'
          ? new Map(Object.entries(titleMatch.canonical))
          : undefined
      const graph = buildGraph(
        {
          viewing: rowsOf('ViewingActivity.csv'),
          searches: rowsOf('SearchHistory.csv'),
          ratings: rowsOf('Ratings.csv'),
          mylist: rowsOf('MyList.csv'),
          streaming: rowsOf('IpAddressesStreaming.csv'),
          logins: rowsOf('IpAddressesLogin.csv'),
        },
        canonical,
      )
      const ctx = {
        apiKey: key,
        rows: rowsOf,
        ensureFile: (file: string) => at().ensureFile(file),
        graph,
        candidates: (text: string) => candidateShows(graph, text),
        topValuesOf: (dataset: DatasetId, field: string, n = 12) =>
          topN(rowsOf(DATASETS[dataset].file), (r) => r[field] ?? '')
            .slice(0, n)
            .map((r) => r.name),
        onProgress: (note: string) => setNote(note),
        aborted: () => useApp.getState().generation !== generation,
      }
      setNote(mode === 'agent' ? 'Planning step 1…' : 'Routing the question…')
      const result = mode === 'agent' ? await runAgent(q, ctx) : await answerQuestion(q, ctx)
      if (useApp.getState().generation !== generation) return
      setAnswer(result)
      setNote('')
    } catch (e) {
      if (useApp.getState().generation !== generation) return
      setError(e instanceof Error ? e.message : 'Could not answer that question.')
      setNote('')
    } finally {
      if (useApp.getState().generation === generation) setBusy(false)
    }
  }

  return (
    <div className="space-y-[120px]">
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Ask about your export</h1>
          <p className="mt-6 font-body text-lg text-body">
            Plain-language questions answered from your parsed rows. Code retrieves,
            Jev judges, and every number cites its evidence — nothing is generated.
          </p>
        </div>
        <Card>
          <div className="grid gap-2">
            <span className="caption-mono">Question</span>
            <Input
              aria-label="Question about your export"
              placeholder="Which show did I watch the most?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void run()
              }}
              className="border-0 border-b border-rule bg-transparent px-0 font-body text-lg placeholder:text-faint focus-visible:border-ink focus-visible:ring-0"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-6" role="group" aria-label="Answering mode">
              <button
                type="button"
                aria-pressed={mode === 'rag'}
                onClick={() => setMode('rag')}
                className={`chip ${mode === 'rag' ? 'chip-on' : ''}`}
              >
                Answer directly
              </button>
              <button
                type="button"
                aria-pressed={mode === 'agent'}
                onClick={() => setMode('agent')}
                className={`chip ${mode === 'agent' ? 'chip-on' : ''}`}
              >
                Think step by step
              </button>
            </div>
            <span className="caption-mono">
              {mode === 'rag' ? 'up to ~20 judgments' : 'up to ~30 judgments across 4 steps'}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <span className="caption-mono">TypeSafe API key</span>
              <Input
                type="password"
                aria-label="TypeSafe API key"
                placeholder="ts_…"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                className="w-64 border-0 border-b border-rule bg-transparent px-0 font-mono text-xs placeholder:text-faint focus-visible:border-ink focus-visible:ring-0"
              />
            </div>
            <Button variant="bugatti" size="pill-sm" onClick={() => void run()} disabled={!question.trim() || !apiKey.trim() || busy}>
              {busy ? 'Asking…' : 'Ask'}
            </Button>
          </div>
          <p className="mt-4 font-body text-sm text-subtle">
            Runs only when you ask. Sends your question plus small row snippets to the
            TypeSafe API — your key stays in this browser.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => setQuestion(example)} className="caption-mono underline decoration-dotted underline-offset-4 hover:text-ink">
                {example}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {(busy || note) && !answer && !error && (
        <p role="status" className="font-body text-lg text-subtle">{note || 'Working…'}</p>
      )}
      {error && (
        <p role="alert" className="font-body text-base text-warning">{error}</p>
      )}

      {answer && (
        <div className="space-y-6">
          {answer.unanswerable ? (
            <Card>
              <SectionTitle>Out of scope</SectionTitle>
              <p className="font-body text-base leading-relaxed text-body">{answer.unanswerable}</p>
              {answer.rows.length > 0 && (
                <div className="mt-6"><DataGrid rows={answer.rows} /></div>
              )}
            </Card>
          ) : (
            <Card>
              <SectionTitle>Answer</SectionTitle>
              <ul className="space-y-5">
                {answer.claims.map((claim, i) => (
                  <li key={i} className="flex gap-4">
                    <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 bg-ink" />
                    <span className="font-body text-lg leading-relaxed text-body">
                      {claim.text}{' '}
                      <span className="font-mono text-xs text-subtle">[{verdictLabel(claim.verdict)}]</span>
                    </span>
                  </li>
                ))}
              </ul>
              {answer.chart && (
                <div className="mt-6">
                  <TimeChart title="Answer trend" data={answer.chart.data} series={[{ key: 'value', label: answer.chart.label }]} unit="" />
                </div>
              )}
              {answer.rows.length > 0 && (
                <div className="mt-6"><DataGrid rows={answer.rows} /></div>
              )}
            </Card>
          )}
          {answer.steps && answer.steps.length > 0 && (
            <Card>
              <SectionTitle>How it got there</SectionTitle>
              <ol className="space-y-4">
                {answer.steps.map((step, i) => (
                  <li key={i} className="font-body text-base text-subtle">
                    <span className="caption-mono mr-3">{step.label}</span>
                    <span className="text-body">{step.observation}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {answer.trail.length > 0 && (
            <details>
              <summary className="caption-mono cursor-pointer hover:text-ink">Judgment trail ({answer.trail.length})</summary>
              <ul className="mt-4 space-y-2">
                {answer.trail.map((t, i) => (
                  <li key={i} className="font-mono text-xs text-subtle">
                    {t.question}: {t.answer} ({Math.round(t.probability * 100)}%)
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="caption-mono">Confidence {Math.round(answer.confidence * 100)}% · weakest judgment rules</p>
        </div>
      )}
    </div>
  )
}
