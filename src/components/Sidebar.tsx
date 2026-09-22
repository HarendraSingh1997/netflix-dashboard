import { useRef, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from 'lucide-react'
import type { InsightTabId, TabId } from '../App'
import { FILE_GROUPS, fileTabToSlug, isFileTab, prettyName, slugify, type FileTabId } from '../lib/files'
import { useApp } from '../lib/store'

export interface SidebarTab {
  id: InsightTabId
  label: string
  icon: LucideIcon
  path: string
}

interface SidebarProps {
  tabs: readonly SidebarTab[]
  tab: TabId
  onNavigate: (tab: TabId) => void
  onHoverInsight: (path: string) => void
  onHoverFile: (slug: string) => void
  open: boolean
  onClose: () => void
}

const MIN_WIDTH = 208
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 256
const RAIL_WIDTH = 64

function clampWidth(value: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)))
}

function readWidth(): number {
  try {
    const saved = Number(localStorage.getItem('ni-sidebar-width'))
    if (Number.isFinite(saved) && saved > 0) return clampWidth(saved)
  } catch { /* private mode */ }
  return DEFAULT_WIDTH
}

function readMinimized(): boolean {
  try {
    return localStorage.getItem('ni-sidebar-minimized') === '1'
  } catch { /* private mode */ }
  return false
}

function FileMeta({ name }: { name: string }) {
  const entry = useApp((s) => s.files[name])
  const label =
    entry?.status === 'ready'
      ? entry.rows.length
        ? `${entry.rows.length.toLocaleString()} records`
        : 'empty'
      : entry?.status === 'missing' || !entry
        ? 'not in export'
        : entry.status
  const dim = entry?.status === 'ready' ? '' : ' text-faint'
  return <span className={`caption-mono shrink-0${dim}`}>{label}</span>
}

function SidebarContent({ tabs, tab, onNavigate, onHoverInsight, onHoverFile, onMinimize }: Omit<SidebarProps, 'open' | 'onClose'> & { onMinimize: () => void }) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set(FILE_GROUPS.map((g) => g.folder)))
  function toggleFolder(folder: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }
  const activeFile = isFileTab(tab) ? fileTabToSlug(tab) : null
  const files = useApp((s) => s.files)
  return (
    <div className="space-y-10 py-6">
      <div className="flex justify-end px-3">
        <button type="button" onClick={onMinimize} aria-label="Minimize navigation" title="Minimize navigation" className="icon-btn size-9">
          <PanelLeftClose className="size-4" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Dashboard sections" className="space-y-1 px-3">
        <p className="caption-mono px-3 pb-2">Sections</p>
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(t.id)}
              onMouseEnter={() => onHoverInsight(t.path)}
              onFocus={() => onHoverInsight(t.path)}
              className={`flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left font-display text-[14px] tracking-[0.02em] transition-colors outline-none ${
                active ? 'border-ink bg-panel text-ink' : 'border-transparent text-subtle hover:text-ink'
              }`}
            >
              <t.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t.label}</span>
            </button>
          )
        })}
      </nav>
      <nav aria-label="Source files" className="space-y-1 px-3">
        <p className="caption-mono px-3 pb-2">Files</p>
        {FILE_GROUPS.map((group) => {
          const open = openFolders.has(group.folder)
          return (
            <div key={group.folder}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggleFolder(group.folder)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left font-display text-[12px] tracking-[0.08em] text-faint uppercase transition-colors outline-none hover:text-ink"
              >
                {open ? <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" /> : <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
                <span className="truncate">{group.folder}</span>
                <span className="caption-mono ml-auto">{group.files.length}</span>
              </button>
              {open &&
                group.files.map((name) => {
                  const slug = slugify(name)
                  const id: FileTabId = `file:${slug}`
                  const active = activeFile === slug
                  const missing = !files[name]
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => onNavigate(id)}
                      onMouseEnter={() => onHoverFile(slug)}
                      onFocus={() => onHoverFile(slug)}
                      title={`${name} — ${prettyName(name)}`}
                      className={`flex w-full items-center gap-3 border-l-2 py-2 pr-3 pl-8 text-left transition-colors outline-none ${
                        active ? 'border-ink bg-panel text-ink' : 'border-transparent text-subtle hover:text-ink'
                      } ${missing ? 'opacity-60' : ''}`}
                    >
                      <FileText className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-display text-[13px] tracking-[0.02em]">{prettyName(name)}</span>
                      <FileMeta name={name} />
                    </button>
                  )
                })}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
function MinimizedRail({ tabs, tab, onNavigate, onExpand }: Pick<SidebarProps, 'tabs' | 'tab' | 'onNavigate'> & { onExpand: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1 py-6">
      <button type="button" onClick={onExpand} aria-label="Expand navigation" title="Expand navigation" className="icon-btn mb-4 size-9">
        <PanelLeftOpen className="size-4" aria-hidden="true" />
      </button>
      {tabs.map((t) => {
        const active = tab === t.id
        return (
          <button
            key={t.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            aria-label={t.label}
            title={t.label}
            onClick={() => onNavigate(t.id)}
            className={`icon-btn size-11 rounded-none border-0 ${active ? 'bg-panel text-ink' : ''}`}
          >
            <t.icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

export default function Sidebar(props: SidebarProps) {
  const { open, onClose } = props
  const [width, setWidth] = useState(readWidth)
  const [minimized, setMinimized] = useState(readMinimized)
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)

  function persist(nextWidth: number, nextMinimized: boolean) {
    try {
      localStorage.setItem('ni-sidebar-width', String(nextWidth))
      localStorage.setItem('ni-sidebar-minimized', nextMinimized ? '1' : '0')
    } catch { /* private mode */ }
  }
  function applyWidth(next: number) {
    const clamped = clampWidth(next)
    setWidth(clamped)
    persist(clamped, minimized)
  }
  function setMinimizedAndPersist(next: boolean) {
    setMinimized(next)
    persist(width, next)
  }

  return (
    <>
      <aside
        className="sticky top-0 hidden h-dvh shrink-0 overflow-y-auto border-r border-line md:block"
        style={{ width: minimized ? RAIL_WIDTH : width }}
        aria-label="Dashboard navigation"
      >
        {minimized ? (
          <MinimizedRail tabs={props.tabs} tab={props.tab} onNavigate={props.onNavigate} onExpand={() => setMinimizedAndPersist(false)} />
        ) : (
          <div className="relative min-h-full">
            <SidebarContent {...props} onMinimize={() => setMinimizedAndPersist(true)} />
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize navigation"
              aria-valuenow={width}
              aria-valuemin={MIN_WIDTH}
              aria-valuemax={MAX_WIDTH}
              tabIndex={0}
              className="absolute inset-y-0 right-0 w-2 cursor-col-resize outline-none hover:bg-line focus-visible:bg-ink"
              onPointerDown={(e) => {
                drag.current = { startX: e.clientX, startWidth: width }
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (drag.current) applyWidth(drag.current.startWidth + e.clientX - drag.current.startX)
              }}
              onPointerUp={() => { drag.current = null }}
              onPointerCancel={() => { drag.current = null }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); applyWidth(width - 16) }
                if (e.key === 'ArrowRight') { e.preventDefault(); applyWidth(width + 16) }
              }}
            />
          </div>
        )}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Dashboard navigation">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-line bg-bg">
            <div className="flex justify-end p-3">
              <button type="button" onClick={onClose} aria-label="Close navigation" className="icon-btn size-9">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <SidebarContent {...props} onMinimize={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}
