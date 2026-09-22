import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, SectionTitle } from './ui'
import { ChartFrame } from './ChartFrame'

const MONO_SERIES = ['var(--color-ink)', 'var(--color-subtle)', 'var(--color-faint)', 'var(--color-rule)', 'var(--color-body)']
// Grouped-series palette: 4 profile colors, then the muted token for 'Other'.
const PROFILE_SERIES = ['var(--profile-1)', 'var(--profile-2)', 'var(--profile-3)', 'var(--profile-4)', 'var(--color-subtle)']
const DASHES = ['', '6 4', '2 3', '9 4', '3 3']

const tooltipStyle = { background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 0 } as const
const tickStyle = { fill: 'var(--color-subtle)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' } as const

export default function TimeChart({
  title,
  data,
  series,
  unit = '',
}: {
  title: string
  data: { month: string; [k: string]: number | string }[]
  series: { key: string; label: string }[]
  unit?: string
}) {
  if (!data.length || !series.length) return null
  // Grouped charts use the profile palette; single-series charts stay ink.
  const palette = series.length > 1 ? PROFILE_SERIES : MONO_SERIES
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <ChartFrame title={`${title} — monthly`}>
        {(full) => (
          <ResponsiveContainer width="100%" height={full ? 520 : 300}>
            <LineChart data={data}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="month" tick={tickStyle} minTickGap={32} />
              <YAxis tick={tickStyle} width={48} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: 'var(--color-ink)', fontFamily: 'JetBrains Mono, monospace' }}
                formatter={((v: number | string, name: string) => [`${Number(v ?? 0).toLocaleString()}${unit}`, series.find((s) => s.key === name)?.label ?? name]) as never}
              />
              {series.length === 1 && <Area type="monotone" dataKey={series[0].key} fill="color-mix(in srgb, var(--color-ink) 13%, transparent)" stroke="none" />}
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={palette[i % palette.length]}
                  strokeDasharray={DASHES[i % DASHES.length] || undefined}
                  strokeWidth={i === 0 ? 2 : 1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartFrame>
      <p className="caption-mono mt-4">Every month in range shown, including zeros · UTC</p>
    </Card>
  )
}
