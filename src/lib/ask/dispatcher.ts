/** Jev dispatcher: natural language -> typed tool call (function-calling pattern).
 *
 * One request carries the tool Choice plus closed-set argument questions; a
 * second request (only when names/values are needed) resolves free text
 * against code-built candidates. Unstated optional args fall back to defaults
 * via `stated` Nouls — exactly like the cookbook. Confidence of a call is the
 * weakest judgment behind it. */

import { TypeSafeClient, choice, noul } from '@typesafe-ai/sdk'
import { JEV_MODEL } from '../jev'
import { DATASETS, TOOLS, type DatasetId } from './tools'

/** Field concepts map to real columns per dataset in code — no dynamic lists. */
const FIELD_CONCEPTS: Record<string, { description: string; column: (d: DatasetId) => string | undefined }> = {
  title: {
    description: 'the title or name column (Title, Displayed Name, Title Name)',
    column: (d) => DATASETS[d].titleField,
  },
  profile: {
    description: 'the Profile Name column',
    column: () => 'Profile Name',
  },
  device: {
    description: 'the Device Type column',
    column: () => 'Device Type',
  },
  date: {
    description: 'the timestamp column (Start Time, Utc Timestamp, …)',
    column: (d) => DATASETS[d].dateField,
  },
  channel: {
    description: 'the Channel column (messages only)',
    column: () => 'Channel',
  },
  action: {
    description: 'the Action column (searches only: play, select, …)',
    column: () => 'Action',
  },
}

export interface DispatchContext {
  /** Candidate show names overlapping the question text (for name resolution). */
  candidates: (text: string) => string[]
  /** Top distinct values of a dataset column (for value resolution). */
  topValuesOf: (dataset: DatasetId, field: string, n?: number) => string[]
  apiKey: string
}

export interface TrailEntry {
  question: string
  answer: string
  probability: number
}

export interface ToolCall {
  tool: string
  args: Record<string, string | number>
  confidence: number
  trail: TrailEntry[]
}

const DATASET_IDS = Object.keys(DATASETS) as DatasetId[]

function datasetCriteria(): Record<string, string | null> {
  return Object.fromEntries(DATASET_IDS.map((id) => [id, DATASETS[id].description]))
}

function fieldCriteria(): Record<string, string | null> {
  return Object.fromEntries(Object.entries(FIELD_CONCEPTS).map(([k, v]) => [k, v.description]))
}

function toolCriteria(): Record<string, string | null> {
  return {
    ...Object.fromEntries(Object.entries(TOOLS).map(([k, v]) => [k, v.description])),
    none: 'the question cannot be answered from export data (opinions, predictions, non-Netflix facts)',
  }
}

/** Nouls carry no confidence — a gate near 0.5 is a coin flip. */
function gateCertainty(noul: number): number {
  return Math.abs(noul - 0.5) * 2
}

function minConfidence(values: number[]): number {
  return values.length ? Math.min(...values) : 1
}

export async function dispatchQuestion(
  question: string,
  dctx: DispatchContext,
  extra: { observations?: string } = {},
): Promise<ToolCall & { sufficient: number }> {
  const client = new TypeSafeClient({ apiKey: dctx.apiKey, baseURL: '/typesafe-api', dangerouslyAllowBrowser: true })
  const trail: TrailEntry[] = []
  const used: number[] = []
  const state: Record<string, string> = extra.observations
    ? { question, known_so_far: extra.observations }
    : { question }

  const route = await client.systemOne(
    {
      state,
      questions: {
        __tool__: choice('What should answer this question about the Netflix export?', toolCriteria()),
        dataset: choice('Which dataset does the question ask about?', datasetCriteria()),
        dataset_stated: noul('Does the question name or imply a specific dataset (viewing, searches, ratings, list, billing, messages)?'),
        field: choice('Which column idea does the question ask about?', fieldCriteria()),
        field_stated: noul('Does the question name a specific column, person, title, device, date, channel, or action to break down or filter by?'),
        sufficient: noul('Is there enough evidence above to answer the question, or is another lookup needed?'),
      },
      model: JEV_MODEL,
    },
    { timeout: 45000 },
  )

  const tool = route.answers.__tool__.choice as string
  used.push(route.answers.__tool__.confidence)
  trail.push({ question: 'tool', answer: tool, probability: route.answers.__tool__.probabilities[tool as keyof typeof route.answers.__tool__.probabilities] ?? 0 })

  if (tool === 'none') {
    return { tool, args: {}, confidence: minConfidence(used), trail, sufficient: route.answers.sufficient.noul }
  }

  const datasetStated = route.answers.dataset_stated.noul >= 0.5
  const dataset = (datasetStated ? (route.answers.dataset.choice as DatasetId) : defaultDataset(tool)) as DatasetId
  if (datasetStated) {
    used.push(route.answers.dataset.confidence, gateCertainty(route.answers.dataset_stated.noul))
    trail.push({ question: 'dataset', answer: dataset, probability: route.answers.dataset.probabilities[dataset] ?? 0 })
  }

  const fieldStated = route.answers.field_stated.noul >= 0.5
  const concept = (fieldStated ? route.answers.field.choice : defaultField(tool)) as string
  if (fieldStated) {
    used.push(route.answers.field.confidence, gateCertainty(route.answers.field_stated.noul))
    trail.push({ question: 'field', answer: concept, probability: route.answers.field.probabilities[concept as keyof typeof route.answers.field.probabilities] ?? 0 })
  }
  const column = FIELD_CONCEPTS[concept]?.column(dataset) ?? FIELD_CONCEPTS.title.column(dataset)!

  const args: Record<string, string | number> = { dataset }

  if (tool === 'topValues' || tool === 'describeValues') {
    args.field = column
  } else if (tool === 'compareProfiles') {
    args.source = dataset === 'searches' ? 'searches' : 'viewing'
  } else if (tool === 'monthlyTrend') {
    // dataset arg suffices
  } else if (tool === 'listFiles') {
    // no args
  } else if (tool === 'filterRows' || tool === 'entityLookup' || tool === 'connections') {
    const resolved = await resolveNames(client, dctx, tool, question, dataset, column)
    Object.assign(args, resolved.args)
    trail.push(...resolved.trail)
    used.push(...resolved.confidences)
  }

  return { tool, args, confidence: minConfidence(used), trail, sufficient: route.answers.sufficient.noul }
}

async function resolveNames(
  client: TypeSafeClient,
  dctx: DispatchContext,
  tool: string,
  question: string,
  dataset: DatasetId,
  column: string,
): Promise<{ args: Record<string, string>; trail: TrailEntry[]; confidences: number[] }> {
  const trail: TrailEntry[] = []
  const confidences: number[] = []
  const args: Record<string, string> = {}

  if (tool === 'entityLookup' || tool === 'connections') {
    const options = dctx.candidates(question)
    if (!options.length) return { args, trail, confidences }
    const first = await client.systemOne(
      {
        state: { question, candidates: options },
        questions: {
          name: choice('Which candidate show does the question ask about?', Object.fromEntries(options.map((o) => [o, `the show “${o}”`]))),
        },
        model: JEV_MODEL,
      },
      { timeout: 45000 },
    )
    const name = first.answers.name.choice as string
    args.name = name
    confidences.push(first.answers.name.confidence)
    trail.push({ question: 'name', answer: name, probability: first.answers.name.probabilities[name as keyof typeof first.answers.name.probabilities] ?? 0 })
    if (tool === 'connections') {
      const rest = options.filter((o) => o !== name)
      if (!rest.length) return { args, trail, confidences }
      const second = await client.systemOne(
        {
          state: { question, candidates: rest },
          questions: {
            other: choice('Which other candidate show does the question compare it with?', Object.fromEntries(rest.map((o) => [o, `the show “${o}”`]))),
          },
          model: JEV_MODEL,
        },
        { timeout: 45000 },
      )
      const other = second.answers.other.choice as string
      args.a = name
      args.b = other
      delete args.name
      confidences.push(second.answers.other.confidence)
      trail.push({ question: 'other', answer: other, probability: second.answers.other.probabilities[other as keyof typeof second.answers.other.probabilities] ?? 0 })
    }
    return { args, trail, confidences }
  }

  // filterRows: value Choice over the resolved column's top values.
  const values = dctx.topValuesOf(dataset, column, 12)
  if (!values.length) {
    args.field = column
    return { args, trail, confidences }
  }
  const picked = await client.systemOne(
    {
      state: { question, values },
      questions: {
        value: choice(`Which ${column} value does the question filter by?`, Object.fromEntries(values.map((v) => [v, `rows where ${column} is “${v}”`] as [string, string]))),
        value_stated: noul(`Does the question name a specific ${column} to filter by?`),
      },
      model: JEV_MODEL,
    },
    { timeout: 45000 },
  )
  args.field = column
  if (picked.answers.value_stated.noul >= 0.5) {
    const value = picked.answers.value.choice as string
    args.value = value
    confidences.push(picked.answers.value.confidence, gateCertainty(picked.answers.value_stated.noul))
    trail.push({ question: 'value', answer: value, probability: picked.answers.value.probabilities[value as keyof typeof picked.answers.value.probabilities] ?? 0 })
  }
  return { args, trail, confidences }
}

function defaultDataset(_tool: string): DatasetId {
  return 'viewing'
}

function defaultField(tool: string): string {
  if (tool === 'compareProfiles') return 'profile'
  return 'title'
}
