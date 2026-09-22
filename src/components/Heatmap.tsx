import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { dayKey, fmtDuration, fmtHours, parseTs, toSeconds } from '../lib/utils'
import type { Row } from '../lib/utils'
import { Card, Empty, SectionTitle } from './ui'
import { ChartFrame, Modal } from './ChartFrame'
import DataGrid from './DataGrid'

type Session = {
  date: Date
  seconds: number
  profile: string
  title: string
  show: string
  device: string
  start: string
}

const ROWS = 20
const CELL = 12
const GAP = 2
const COL_WIDTH = CELL + GAP

/** Every viewing session as one heat cell, oldest to newest, left to right.
/// Columns virtualize so all 126k+ records stay reachable inside a single
/// horizontal scrollbar. Color tracks session length (log scale); any cell
/// opens its session record in a dialog. */
export default function Heatmap({ rows }: { rows: Row[] }) {
  const [drill, setDrill] = useState<{ title: string; sessions: Session[] } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const sessions: Session[] = rows
    .flatMap((row) => {
      const date = parseTs(row['Start Time'])
      const seconds = toSeconds(row['Duration'])
      if (!date || seconds <= 0) return []
      return [{
        date,
        seconds,
        profile: row['Profile Name'] || 'Unknown',
        title: row['Title'] || 'Unknown',
        show: (row['Title'] || 'Unknown').split(':')[0],
        device: row['Device Type'] || 'Unknown',
        start: row['Start Time'] || '',
      }]
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const totalSeconds = sessions.reduce((sum, s) => sum + s.seconds, 0)
  // Loop, not Math.max(...arr): spreading 126k args overflows the call stack.
  let maxSeconds = 1
  for (const s of sessions) if (s.seconds > maxSeconds) maxSeconds = s.seconds
  const cols = Math.ceil(sessions.length / ROWS)
  const totalWidth = cols * COL_WIDTH

  const monthTicks = (() => {
    const ticks: { label: string; x: number }[] = []
    let last = ''
    sessions.forEach((s, i) => {
      const label = s.date.toISOString().slice(0, 7)
      if (label !== last) {
        last = label
        ticks.push({ label, x: Math.floor(i / ROWS) * COL_WIDTH })
      }
    })
    // Skip labels that would overlap the previous one.
    return ticks.filter((t, i) => i === 0 || t.x - ticks[i - 1].x >= 56)
  })()

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: cols,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => COL_WIDTH,
    overscan: 12,
  })
  const virtualCols = columnVirtualizer.getVirtualItems()

  if (!rows.length) return null
  if (!sessions.length) return <Empty label="No sessions with a valid duration in these records" />

  const alpha = (seconds: number) => 0.08 + 0.92 * (Math.log(1 + seconds) / Math.log(1 + maxSeconds))

  const openSession = (s: Session) => {
    const day = dayKey(s.date)
    const sameDay = sessions.filter((o) => dayKey(o.date) === day)
    setDrill({ title: `${day} — ${sameDay.length.toLocaleString()} sessions`, sessions: sameDay })
  }

  return (
    <Card>
      <SectionTitle>Every session, in order</SectionTitle>
      <ChartFrame title="Session heatmap">
        <div ref={scrollRef} className="overflow-x-auto" tabIndex={0} aria-label="Scrollable session heatmap, oldest to newest">
          <div className="relative" style={{ width: totalWidth, height: ROWS * COL_WIDTH + 22 }}>
            <div className="absolute inset-x-0 top-0 h-[22px]">
              {monthTicks.map((t) => (
                <span key={t.label} className="absolute top-0 font-mono text-[10px] text-faint" style={{ left: t.x }}>
                  {t.label}
                </span>
              ))}
            </div>
            {virtualCols.map((vc) => (
              <div key={vc.index} className="absolute top-[22px] flex" style={{ left: vc.start, width: COL_WIDTH, gap: GAP, flexDirection: 'column' }}>
                {Array.from({ length: ROWS }, (_, r) => {
                  const s = sessions[vc.index * ROWS + r]
                  if (!s) return <span key={r} style={{ width: CELL, height: CELL }} />
                  const label = `${s.start} UTC — ${s.title} (${s.profile}, ${fmtDuration(s.seconds)})`
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => openSession(s)}
                      aria-label={`View session: ${label}`}
                      title={`${label}. Activate for details.`}
                      className="block rounded-[2px]"
                      style={{ width: CELL, height: CELL, background: `rgba(var(--heat),${alpha(s.seconds)})` }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </ChartFrame>
      <p className="mt-3 text-xs text-subtle">
        {sessions.length.toLocaleString()} sessions · {fmtHours(totalSeconds)} total across {new Set(sessions.map((s) => dayKey(s.date))).size.toLocaleString()} days · shade tracks session length · scroll sideways
      </p>

      {drill && (
        <Modal title={drill.title} onClose={() => setDrill(null)} wide>
          <DataGrid rows={drill.sessions.map((s) => ({
            'Start Time': s.start,
            Profile: s.profile,
            Title: s.title,
            Show: s.show,
            Device: s.device,
            Duration: fmtDuration(s.seconds),
          }))} />
        </Modal>
      )}
    </Card>
  )
}
