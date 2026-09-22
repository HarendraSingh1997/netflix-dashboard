/** RAG + agent pipelines over the export.
 *
 * Shape of every answer: code retrieves and executes, Jev routes / reranks /
 * verifies, code assembles claims from rows. A claim is only as strong as its
 * citation check; verification failures degrade to `unchecked`, never to
 * invented numbers. */

import { TypeSafeClient, noul } from '@typesafe-ai/sdk'
import { JEV_MODEL } from '../jev'
import { DATASETS, TOOLS, type DatasetId, type EvidenceRow, type ToolResult } from './tools'
import { dispatchQuestion, type ToolCall, type TrailEntry } from './dispatcher'
import type { Graph } from './graph'
import type { Row } from '../utils'

export const MAX_RERANK_ROWS = 15
export const MAX_AGENT_STEPS = 4

export interface AskContext {
  apiKey: string
  rows: (file: string) => Row[]
  ensureFile: (file: string) => Promise<void>
  graph: Graph
  candidates: (text: string) => string[]
  topValuesOf: (dataset: DatasetId, field: string, n?: number) => string[]
  onProgress?: (note: string) => void
  aborted?: () => boolean
}

export interface AnswerClaim {
  text: string
  verdict: 'supported' | 'flagged' | 'unchecked'
  confidence: number
}

export interface AgentStep {
  label: string
  observation: string
}

export interface AskAnswer {
  mode: 'rag' | 'agent'
  claims: AnswerClaim[]
  rows: EvidenceRow[]
  chart?: { data: { month: string; value: number }[]; label: string }
  trail: TrailEntry[]
  steps?: AgentStep[]
  confidence: number
  unanswerable?: string
}

function progress(ctx: AskContext, note: string) {
  ctx.onProgress?.(note)
}

function filesForCall(call: ToolCall): string[] {
  const dataset = call.args.dataset as DatasetId | undefined
  switch (call.tool) {
    case 'topValues':
    case 'filterRows':
    case 'monthlyTrend':
      return dataset ? [DATASETS[dataset].file] : []
    case 'compareProfiles':
      return ['ViewingActivity.csv', 'SearchHistory.csv']
    case 'entityLookup':
    case 'connections':
      return ['ViewingActivity.csv', 'SearchHistory.csv', 'Ratings.csv', 'MyList.csv']
    default:
      return []
  }
}

function throwIfAborted(ctx: AskContext) {
  if (ctx.aborted?.()) throw new Error('Question cleared before answering finished.')
}

async function executeCall(ctx: AskContext, call: ToolCall): Promise<ToolResult> {
  for (const file of filesForCall(call)) {
    progress(ctx, `Reading ${file.replace(/\.(csv|txt)$/i, '')}…`)
    await ctx.ensureFile(file)
    throwIfAborted(ctx)
  }
  return TOOLS[call.tool].run(
    { rows: (file) => ctx.rows(file) as Record<string, string>[], graph: ctx.graph },
    call.args,
  )
}

function trimRow(row: EvidenceRow): string {
  return Object.entries(row)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
    .join(' · ')
}

/** One batched request: a relevance Noul per evidence row (parallel pattern). */
async function rerankRows(
  ctx: AskContext,
  question: string,
  rows: EvidenceRow[],
): Promise<{ rows: EvidenceRow[]; checked: boolean }> {
  const candidates = rows.slice(0, MAX_RERANK_ROWS)
  if (candidates.length <= 1) return { rows: candidates, checked: false }
  try {
    const client = new TypeSafeClient({ apiKey: ctx.apiKey, baseURL: '/typesafe-api', dangerouslyAllowBrowser: true })
    const texts = candidates.map(trimRow)
    const response = await client.systemOne(
      {
        state: { question, candidates: texts },
        questions: Object.fromEntries(
          texts.map((text, i) => [`rel${i}`, noul(`Is this row relevant evidence for the question? Row: ${text}`)]),
        ),
        model: JEV_MODEL,
      },
      { timeout: 60000 },
    )
    const kept = candidates.filter((_, i) => (response.answers[`rel${i}`]?.noul ?? 0) >= 0.5)
    return { rows: kept.length ? kept : candidates.slice(0, 3), checked: true }
  } catch {
    return { rows: candidates, checked: false }
  }
}

/** One batched request: a citation Noul per claim against kept evidence. */
async function checkClaims(
  ctx: AskContext,
  claims: string[],
  evidence: EvidenceRow[],
): Promise<AnswerClaim[]> {
  const serialized = JSON.stringify(evidence.slice(0, 15)).slice(0, 3000)
  try {
    const client = new TypeSafeClient({ apiKey: ctx.apiKey, baseURL: '/typesafe-api', dangerouslyAllowBrowser: true })
    const response = await client.systemOne(
      {
        state: { evidence: serialized || '(no rows)' },
        questions: Object.fromEntries(
          claims.map((claim, i) => [`cite${i}`, noul(`Does the evidence support this claim? Claim: ${claim}`)]),
        ),
        model: JEV_MODEL,
      },
      { timeout: 60000 },
    )
    return claims.map((text, i) => {
      const n = response.answers[`cite${i}`]?.noul ?? 0.5
      return {
        text,
        verdict: (n >= 0.5 ? 'supported' : 'flagged') as AnswerClaim['verdict'],
        confidence: Math.abs(n - 0.5) * 2,
      }
    })
  } catch {
    return claims.map((text) => ({ text, verdict: 'unchecked' as const, confidence: 0 }))
  }
}

function dispatchContext(ctx: AskContext) {
  return {
    apiKey: ctx.apiKey,
    candidates: ctx.candidates,
    topValuesOf: ctx.topValuesOf,
  }
}

/** RAG: dispatch once, execute, rerank evidence, citation-check the claim. */
export async function answerQuestion(question: string, ctx: AskContext): Promise<AskAnswer> {
  progress(ctx, 'Routing the question…')
  const call = await dispatchQuestion(question, dispatchContext(ctx))
  throwIfAborted(ctx)

  if (call.tool === 'none' || !(call.tool in TOOLS)) {
    const files = TOOLS.listFiles.run(
      { rows: (file) => ctx.rows(file) as Record<string, string>[], graph: ctx.graph },
      {},
    )
    return {
      mode: 'rag',
      claims: [],
      rows: files.rows,
      trail: call.trail,
      confidence: call.confidence,
      unanswerable:
        'That needs data outside this export (opinions, predictions, or non-Netflix facts). Datasets available are listed below — try asking about those.',
    }
  }

  progress(ctx, 'Running the lookup…')
  const result = await executeCall(ctx, call)
  progress(ctx, 'Checking evidence…')
  const { rows } = await rerankRows(ctx, question, result.rows)
  throwIfAborted(ctx)
  const claims = await checkClaims(ctx, [result.claim], rows)
  return {
    mode: 'rag',
    claims,
    rows,
    chart: result.chart,
    trail: call.trail,
    confidence: Math.min(call.confidence, ...claims.map((c) => c.confidence)),
  }
}

/** Agent: up to MAX_AGENT_STEPS dispatch→execute rounds, then synthesize. */
export async function runAgent(question: string, ctx: AskContext): Promise<AskAnswer> {
  const trail: TrailEntry[] = []
  const steps: AgentStep[] = []
  const seen = new Set<string>()
  const observations: string[] = []
  const evidences: EvidenceRow[][] = []
  const confidences: number[] = []
  let chart: AskAnswer['chart']

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    progress(ctx, step === 0 ? 'Planning step 1…' : `Planning step ${step + 1}…`)
    const call = await dispatchQuestion(question, dispatchContext(ctx), {
      observations: observations.length ? observations.join('\n') : undefined,
    })
    throwIfAborted(ctx)
    trail.push(...call.trail.map((t) => ({ ...t, question: `step${step + 1}:${t.question}` })))
    confidences.push(call.confidence)

    if (call.tool === 'none' || !(call.tool in TOOLS)) break
    const key = `${call.tool}:${JSON.stringify(call.args)}`
    if (seen.has(key)) break
    seen.add(key)

    const result = await executeCall(ctx, call)
    observations.push(result.claim)
    evidences.push(result.rows)
    if (result.chart) chart = result.chart
    steps.push({ label: call.tool, observation: result.claim })
    if (call.sufficient >= 0.6) break
  }

  if (!steps.length) {
    return {
      mode: 'agent',
      claims: [],
      rows: [],
      trail,
      steps,
      confidence: Math.min(...confidences, 1),
      unanswerable: 'Nothing answerable was found in the export — try rephrasing around titles, profiles, dates, or devices.',
    }
  }

  progress(ctx, 'Checking evidence…')
  const combined = evidences.flat().slice(0, MAX_RERANK_ROWS)
  const { rows } = await rerankRows(ctx, question, combined)
  throwIfAborted(ctx)
  const claims = await checkClaims(
    ctx,
    steps.map((s) => s.observation),
    rows,
  )
  return {
    mode: 'agent',
    claims,
    rows,
    chart,
    trail,
    steps,
    confidence: Math.min(...confidences, ...claims.map((c) => c.confidence)),
  }
}
