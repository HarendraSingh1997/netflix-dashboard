import { useState } from 'react'
import { Card, SectionTitle } from './ui'
import { ChartFrame, Modal } from './ChartFrame'
import DataGrid from './DataGrid'
import type { Row } from '../lib/utils'

const STATE_POS: Record<string, [number, number, string]> = {
  'Jammu and Kashmir': [2, 0, 'JK'], 'Ladakh': [3, 0, 'LD'],
  'Himachal Pradesh': [1, 1, 'HP'], 'Punjab': [2, 1, 'PB'], 'Uttarakhand': [3, 1, 'UK'],
  'Haryana': [1, 2, 'HR'], 'Delhi': [2, 2, 'DL'], 'Uttar Pradesh': [3, 2, 'UP'],
  'Bihar': [4, 2, 'BR'], 'West Bengal': [5, 2, 'WB'], 'Assam': [6, 2, 'AS'],
  'Rajasthan': [0, 3, 'RJ'], 'Madhya Pradesh': [2, 3, 'MP'], 'Chhattisgarh': [3, 3, 'CG'],
  'Jharkhand': [4, 3, 'JH'],
  'Gujarat': [0, 4, 'GJ'], 'Maharashtra': [2, 4, 'MH'], 'Odisha': [5, 4, 'OD'],
  'Goa': [1, 5, 'GA'], 'Karnataka': [3, 5, 'KA'], 'Telangana': [4, 5, 'TS'],
  'Andhra Pradesh': [5, 5, 'AP'],
  'Kerala': [3, 6, 'KL'], 'Tamil Nadu': [4, 6, 'TN'],
  'Arunachal Pradesh': [7, 2, 'AR'], 'Nagaland': [7, 3, 'NL'], 'Manipur': [7, 4, 'MN'],
  'Mizoram': [7, 5, 'MZ'], 'Tripura': [7, 6, 'TR'], 'Meghalaya': [6, 3, 'ML'],
  'Sikkim': [6, 1, 'SK'], 'Chandigarh': [2, 3, 'CH'],
}

const CODE_TO_STATE: Record<string, string> = {
  KA: 'Karnataka', DL: 'Delhi', RJ: 'Rajasthan', HR: 'Haryana', UP: 'Uttar Pradesh',
  BR: 'Bihar', MH: 'Maharashtra', PB: 'Punjab', JH: 'Jharkhand', TN: 'Tamil Nadu',
  GJ: 'Gujarat', UK: 'Uttarakhand', KL: 'Kerala', AP: 'Andhra Pradesh', TS: 'Telangana',
  MP: 'Madhya Pradesh', GA: 'Goa', OD: 'Odisha', OR: 'Odisha', AS: 'Assam', WB: 'West Bengal',
  CG: 'Chhattisgarh', CT: 'Chhattisgarh', CH: 'Chandigarh', HP: 'Himachal Pradesh',
  JK: 'Jammu and Kashmir', LA: 'Ladakh', LD: 'Ladakh', AN: 'Andaman and Nicobar Islands',
  DN: 'Dadra and Nagar Haveli and Daman and Diu', LD_: 'Lakshadweep', PY: 'Puducherry',
  AR: 'Arunachal Pradesh', MN: 'Manipur', ML: 'Meghalaya', MZ: 'Mizoram', NL: 'Nagaland',
  TR: 'Tripura', SK: 'Sikkim',
}

function normalizeRegion(raw: string): string {
  const value = (raw || '').trim()
  if (!value) return 'Unknown'
  const upper = value.toUpperCase()
  if (CODE_TO_STATE[upper]) return CODE_TO_STATE[upper]
  if (upper === 'DU' || upper === 'DUBAI') return 'Dubai'
  return value
}

export default function GeoMap({
  indian,
  outside,
}: {
  indian: { rows: Row[]; match: (row: Row) => string }[]
  outside: { label: string; rows: Row[]; count?: number }[]
}) {
  const [drill, setDrill] = useState<{ title: string; rows: Row[] } | null>(null)

  const { placed, unplaced, max } = (() => {
    const counts = new Map<string, { count: number; rows: Row[] }>()
    const hit = (name: string, row: Row) => {
      const entry = counts.get(name) ?? { count: 0, rows: [] }
      entry.count++
      entry.rows.push(row)
      counts.set(name, entry)
    }
    for (const source of indian) for (const row of source.rows) hit(normalizeRegion(source.match(row)), row)
    const placedStates = new Map<string, { count: number; rows: Row[] }>()
    const rest: { label: string; count: number; rows: Row[] }[] = []
    for (const [name, entry] of counts) {
      if (STATE_POS[name]) placedStates.set(name, entry)
      else rest.push({ label: name, ...entry })
    }
    for (const o of outside) rest.push({ label: o.label, rows: o.rows, count: o.count ?? o.rows.length })
    rest.sort((a, b) => b.count - a.count)
    let max = 1
    for (const e of placedStates.values()) max = Math.max(max, e.count)
    for (const e of rest) max = Math.max(max, e.count)
    return { placed: placedStates, unplaced: rest, max }
  })()

  if (!placed.size && !unplaced.length) return null

  const renderTile = (key: string, code: string, label: string, count: number, rows: Row[], x: number, y: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setDrill({ title: `${label} — ${count.toLocaleString()} events`, rows })}
      aria-label={`View ${count} events in ${label}`}
      title={`${label} — ${count.toLocaleString()} events. Activate for records.`}
      className="flex flex-col items-center justify-center border border-line outline-none transition-colors hover:border-ink focus-visible:border-ink"
      style={{ gridColumn: x + 1, gridRow: y + 1, background: `rgba(var(--heat),${0.04 + 0.5 * (count / max)})`, minHeight: 64 }}
    >
      <span className="font-display text-lg tracking-[2px] text-ink">{code}</span>
      <span className="px-1 font-mono text-[10px] tabular-nums text-subtle">{count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}</span>
    </button>
  )

  return (
    <Card>
      <SectionTitle>Where streaming happens</SectionTitle>
      <ChartFrame title="Activity tile map">
        <div className="space-y-10">
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }} role="group" aria-label="Indian states by streaming activity">
            {[...placed.entries()].map(([name, entry]) => {
              const [x, y, code] = STATE_POS[name]
              return renderTile(name, code, name, entry.count, entry.rows, x, y)
            })}
          </div>
          {unplaced.length > 0 && (
            <div>
              <p className="caption-mono mb-4">Outside the mapped states</p>
              <div className="flex flex-wrap gap-2">
                {unplaced.map((entry) => (
                  <button key={entry.label} type="button" onClick={() => setDrill({ title: `${entry.label} — ${entry.count.toLocaleString()} events`, rows: entry.rows })} aria-label={`View ${entry.count} events in ${entry.label}`} className="border border-line px-4 py-2 font-mono text-[11px] tracking-[2px] text-subtle uppercase transition-colors hover:border-ink hover:text-ink">
                    {entry.label} · {entry.count.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="caption-mono">Tile shade tracks event volume · regions as reported by the export · UTC</p>
        </div>
      </ChartFrame>
      {drill && (
        <Modal title={drill.title} onClose={() => setDrill(null)} wide>
          <DataGrid rows={drill.rows} />
        </Modal>
      )}
    </Card>
  )
}
