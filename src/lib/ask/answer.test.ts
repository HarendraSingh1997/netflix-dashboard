import { describe, expect, it, vi } from 'vitest'

vi.mock('@typesafe-ai/sdk', () => ({
  TypeSafeClient: class {
    async systemOne(request: { questions: Record<string, unknown> }) {
      const answers: Record<string, unknown> = {}
      for (const key of Object.keys(request.questions)) {
        answers[key] =
          key.startsWith('rel') || key.startsWith('cite') ? { noul: 0.9 } : { noul: 0.5 }
      }
      return { answers, model: 'test-model', usage: { input_tokens: 0, output_tokens: 0 } }
    }
  },
  choice: (instructions: string, criteria: unknown) => ({ type: 'choice', instructions, criteria }),
  noul: (instructions: string) => ({ type: 'noul', instructions }),
  score: (instructions: string, criteria: unknown) => ({ type: 'score', instructions, criteria }),
}))

vi.mock('./dispatcher', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./dispatcher')>()
  return {
    ...mod,
    dispatchQuestion: async () => ({
      tool: 'topValues',
      args: { dataset: 'viewing', field: 'Profile Name', n: 10 },
      confidence: 0.9,
      trail: [],
      sufficient: 0.9,
    }),
  }
})

import { answerQuestion, runAgent, type AskContext } from './answer'
import { buildGraph } from './graph'

const viewing = [
  { Title: 'Show', 'Profile Name': 'A', 'Start Time': '2024-01-05 10:00:00', Duration: '1:00:00' },
  { Title: 'Show', 'Profile Name': 'A', 'Start Time': '2024-02-05 10:00:00', Duration: '0:30:00' },
  { Title: 'Other', 'Profile Name': 'B', 'Start Time': '2024-02-06 10:00:00', Duration: '0:10:00' },
]

function makeCtx(): AskContext {
  const files: Record<string, Record<string, string>[]> = { 'ViewingActivity.csv': viewing }
  return {
    apiKey: 'test-key',
    rows: (file) => files[file] ?? [],
    ensureFile: async () => {},
    graph: buildGraph({ viewing, searches: [], ratings: [], mylist: [], streaming: [], logins: [] }),
    candidates: () => [],
    topValuesOf: () => [],
  }
}

describe('answerQuestion (mocked Jev)', () => {
  it('routes, executes, reranks, and citation-checks', async () => {
    const answer = await answerQuestion('who watches most?', makeCtx())
    expect(answer.mode).toBe('rag')
    expect(answer.claims).toHaveLength(1)
    expect(answer.claims[0].verdict).toBe('supported')
    expect(answer.claims[0].text).toContain('A')
    expect(answer.rows.length).toBeGreaterThan(0)
    expect(answer.confidence).toBeGreaterThan(0)
  })
})

describe('runAgent (mocked Jev)', () => {
  it('stops after one sufficient step and synthesizes', async () => {
    const answer = await runAgent('who watches most?', makeCtx())
    expect(answer.mode).toBe('agent')
    expect(answer.steps).toHaveLength(1)
    expect(answer.claims[0].verdict).toBe('supported')
  })

  it('aborts when cleared mid-run', async () => {
    const ctx = makeCtx()
    ctx.aborted = () => true
    await expect(answerQuestion('who watches most?', ctx)).rejects.toThrow()
  })
})
