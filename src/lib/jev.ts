/** Jev (TypeSafe System One) judgments for title matching.
 *
 * One request per candidate pair, following the entity-alignment pattern: a
 * Score whose three levels ARE the three outcomes (no fitted thresholds),
 * plus Nouls that ride along to say which aspect disagrees when a pair lands
 * in the middle. Code owns routing, merging, and display; Jev only judges.
 *
 * Privacy: this is the single module that talks to the network. It sends two
 * title strings per call — never counts, profiles, or account data. Callers
 * must gate it behind explicit user opt-in (see Discovery). */

import { TypeSafeClient, noul, score } from '@typesafe-ai/sdk'

export const JEV_MODEL = 'jev-latest'
export const MAX_PAIRS = 40

const LEVELS = [
  'They name two different shows.',
  'They name closely related shows that may or may not be the same one: a spinoff, remake, regional rename, or a title that could plausibly refer to either.',
  'They name one and the same show (season, episode, year, or edition suffixes may differ).',
] as const

const OUTCOMES = ['different', 'related', 'same'] as const
export type PairOutcome = (typeof OUTCOMES)[number]

const QUESTIONS = {
  link: score('How do the two title strings relate as Netflix shows?', [...LEVELS]),
  same_base: noul('Do both titles name the same base show, ignoring season, episode, year, or edition differences?'),
  same_scope: noul('Do both titles refer to the same scope — the same show and installment, not different seasons, episodes, or editions?'),
}

export interface PairJudgment {
  outcome: PairOutcome
  score: number
  confidence: number
  sameBase: number
  sameScope: number
  model: string
}

export function routeOutcome(value: number): PairOutcome {
  return OUTCOMES[Math.min(2, Math.max(0, Math.round(value)))]
}

export async function judgeTitlePair(apiKey: string, a: string, b: string): Promise<PairJudgment> {
  // Browser-only app + user-supplied personal key: the key holder accepts the
  // exposure risk by pasting it (or setting VITE_TYPESAFE_API_KEY locally).
  // Requests go through the same-origin Vite proxy (see vite.config.ts) because
  // api.typesafe.ai rejects browser origins via CORS.
  const client = new TypeSafeClient({ apiKey, baseURL: '/typesafe-api', dangerouslyAllowBrowser: true })
  const response = await client.systemOne(
    {
      state: { title_a: a, title_b: b },
      questions: QUESTIONS,
      model: JEV_MODEL,
    },
    { timeout: 45000 },
  )
  const link = response.answers.link
  return {
    outcome: routeOutcome(link.score),
    score: link.score,
    confidence: link.confidence,
    sameBase: response.answers.same_base.noul,
    sameScope: response.answers.same_scope.noul,
    model: response.model,
  }
}
