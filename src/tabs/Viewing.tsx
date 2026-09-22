import { useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Sankey, Tooltip, XAxis, YAxis,
} from 'recharts'
import { usePending, useRows } from '../lib/store'
import { fmtDuration, parseTs, toSeconds, topN } from '../lib/utils'
import { monthlyViewing, viewingFlow } from '../lib/analytics'
import { profileColorVar } from '../lib/profiles'
import { BarList, Card, Empty, InsightsCard, KpiGrid, SectionTitle, TabSkeleton } from '../components/ui'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select'
import { ChartFrame } from '../components/ChartFrame'
import DataGrid from '../components/DataGrid'
import Heatmap from '../components/Heatmap'

const tooltipStyle = { background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 0 } as const
const tickStyle = { fill: 'var(--color-subtle)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' } as const
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Session = {
  date: Date
  seconds: number
  profile: string
  title: string
  show: string
  device: string
  start: string
}

export default function Viewing() {
  const viewing = useRows('ViewingActivity.csv')
  const pending = usePending('ViewingActivity.csv')
  const [profile, setProfile] = useState('')

  const sessions: Session[] = viewing.flatMap((row) => {
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
  const filtered = (profile ? sessions.filter((s) => s.profile === profile) : sessions)
  const profiles = [...new Set(sessions.map((s) => s.profile))].sort()
  const totalSeconds = filtered.reduce((sum, s) => sum + s.seconds, 0)
  const profileRows = (profile ? viewing.filter((r) => (r['Profile Name'] || 'Unknown') === profile) : viewing)
  const trend = monthlyViewing(profileRows)
  const flow = viewingFlow(profileRows)
  const rankedProfiles = topN(filtered, (s) => s.profile).map((r) => r.name)
  const shortName = (name: string) => {
    const bare = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name
    return bare.length > 26 ? `${bare.slice(0, 25)}…` : bare
  }
  const sankeyNode = (props: any) => {
    const { x, y, width, height, payload } = props
    const name: string = payload.name ?? ''
    const isProfile = name.startsWith('Profile:')
    const bare = shortName(name)
    const fill = isProfile ? profileColorVar(bare, rankedProfiles) : 'var(--color-faint)'
    const labelX = isProfile ? x - 8 : x + width + 8
    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={fill} stroke="var(--color-line)" />
        <text x={labelX} y={y + height / 2} dy="0.35em" textAnchor={isProfile ? 'end' : 'start'} fill="var(--color-body)" fontSize={12}>
          {bare}
        </text>
      </g>
    )
  }
  const sankeyLink = (props: any) => {
    const { sourceX, sourceY, targetX, targetY, sourceControlX, targetControlX, linkWidth, payload } = props
    const sourceName: string = payload.source.name ?? ''
    const bare = sourceName.startsWith('Profile:') ? sourceName.slice('Profile:'.length) : shortName(sourceName)
    return (
      <path
        d={`M ${sourceX},${sourceY} C ${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={profileColorVar(bare, rankedProfiles)}
        strokeWidth={Math.max(linkWidth, 1)}
        strokeOpacity={0.8}
      />
    )
  }

  const insights = (() => {
    if (!filtered.length) return []
    const out: string[] = []
    const shows = topN(filtered, (s) => s.show)
    if (shows[0]) out.push(`“${shows[0].name}” is the most-played title family with ${shows[0].value.toLocaleString()} sessions (${Math.round(shows[0].value / filtered.length * 100)}% of sessions).`)
    const byHour = new Array(24).fill(0) as number[]
    const byDay = new Array(7).fill(0) as number[]
    for (const s of filtered) {
      byHour[s.date.getUTCHours()] += s.seconds
      byDay[s.date.getUTCDay()] += s.seconds
    }
    const peakHour = byHour.indexOf(Math.max(...byHour))
    const peakDay = byDay.indexOf(Math.max(...byDay))
    out.push(`Peak viewing hour is ${String(peakHour).padStart(2, '0')}:00 UTC on ${DAYS[peakDay]}s.`)
    const longest = filtered.reduce((best, s) => (s.seconds > best.seconds ? s : best), filtered[0])
    out.push(`Longest session: ${fmtDuration(longest.seconds)} of “${longest.title}”.`)
    const devices = topN(filtered, (s) => s.device)
    if (devices[0]) out.push(`${devices[0].name} carries ${devices[0].value.toLocaleString()} sessions — the primary screen.`)
    return out.slice(0, 4)
  })()

  if (pending) return <TabSkeleton charts={4} cards={3} columns={3} table />
  if (!viewing.length) return <Empty label="No viewing activity found in this export" />

  return (
    <div className="space-y-[120px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="page-title">Viewing</h1>
        <div className="flex items-center gap-2 text-sm">
          <Label className="caption-mono">Profile</Label>
          <Select value={profile || '__all'} onValueChange={(v) => setProfile(!v || v === '__all' ? '' : v)}>
            <SelectTrigger aria-label="Profile" className="w-44 rounded-none border-0 border-b border-rule bg-transparent px-0 font-mono text-xs tracking-[2px] uppercase">
              <span className="flex flex-1 items-center gap-1.5 truncate text-left">{profile || 'All profiles'}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All profiles</SelectItem>
              {profiles.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <KpiGrid items={[
        { label: 'Watch time', value: fmtDuration(totalSeconds), sub: `${filtered.length.toLocaleString()} sessions` },
        { label: 'Titles', value: new Set(filtered.map((s) => s.title)).size.toLocaleString() },
        { label: 'Shows / movies', value: new Set(filtered.map((s) => s.show)).size.toLocaleString() },
        { label: 'Avg session', value: fmtDuration(filtered.length ? totalSeconds / filtered.length : 0) },
      ]} />
      </div>
      <InsightsCard items={insights} />

      <Card>
        <SectionTitle>Watch-time trend (all months, hours)</SectionTitle>
        <ChartFrame title="Monthly watch-time trend">
          {(full) => (
            <ResponsiveContainer width="100%" height={full ? 520 : 300}>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="month" tick={tickStyle} minTickGap={24} />
                <YAxis tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-ink)', fontFamily: 'JetBrains Mono, monospace' }} />
                <Area type="monotone" dataKey="hours" fill="color-mix(in srgb, var(--color-ink) 13%, transparent)" stroke="none" />
                <Line type="monotone" dataKey="hours" stroke="var(--color-ink)" strokeWidth={2} dot={false} name="Hours" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
        <p className="mt-2 text-xs text-subtle">Every month in range is shown, including months with zero recorded watch time.</p>
      </Card>

      <Card>
        <SectionTitle>Watch-time volume (all months, hours)</SectionTitle>
        <ChartFrame title="Monthly watch-time volume">
          {(full) => (
            <ResponsiveContainer width="100%" height={full ? 520 : 260}>
              <AreaChart data={trend}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="month" tick={tickStyle} minTickGap={24} />
                <YAxis tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-ink)', fontFamily: 'JetBrains Mono, monospace' }} />
                <Area type="monotone" dataKey="hours" fill="color-mix(in srgb, var(--color-ink) 20%, transparent)" stroke="var(--color-ink)" name="Hours" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartFrame>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <SectionTitle>All shows &amp; movies</SectionTitle>
          <BarList data={topN(filtered, (s) => s.show)} unit=" sessions" title="Shows ranked by sessions" />
        </Card>
        <Card>
          <SectionTitle>All devices</SectionTitle>
          <BarList data={topN(filtered, (s) => s.device)} unit=" sessions" title="Devices ranked by sessions" />
        </Card>
        <Card>
          <SectionTitle>All weekdays</SectionTitle>
          <BarList data={topN(filtered, (s) => DAYS[s.date.getUTCDay()])} unit=" sessions" title="Weekdays ranked by sessions" />
        </Card>
      </div>

      <Card>
        <SectionTitle>Profile → device flow (all sessions)</SectionTitle>
        <ChartFrame title="Profile to device Sankey">
          {(full) => (
            <ResponsiveContainer width="100%" height={full ? 560 : 340}>
              <Sankey
                data={flow}
                nodePadding={16}
                nodeWidth={12}
                margin={{ top: 5, right: 190, bottom: 5, left: 90 }}
                link={sankeyLink}
                node={sankeyNode}
              >
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: 'var(--color-ink)', fontFamily: 'JetBrains Mono, monospace' }}
                  itemStyle={{ color: 'var(--color-ink)' }}
                  formatter={((value: unknown, name: unknown) => {
                    const text = String(name ?? '')
                    const bare = text.includes(':') ? text.slice(text.indexOf(':') + 1) : text
                    return [Number(value ?? 0).toLocaleString(), bare]
                  }) as never}
                />
              </Sankey>
            </ResponsiveContainer>
          )}
        </ChartFrame>
        <p className="mt-2 text-xs text-subtle">{flow.nodes.length.toLocaleString()} nodes · {flow.links.length.toLocaleString()} profile-device pairs · every session counted.</p>
      </Card>

      <Heatmap rows={profileRows} />

      <Card>
        <SectionTitle>All sessions</SectionTitle>
        <DataGrid rows={profileRows} />
      </Card>
    </div>
  )
}
