import { useEffect, useRef, useState } from 'react'
import {
  Clapperboard, Compass, Database, FolderOpen, Gamepad2, LayoutDashboard,
  Menu, MessagesSquare, MonitorSmartphone, Moon, Receipt, Settings2, Sun,
  // MessageCircleQuestion, // Ask tab icon, temporarily disabled
  ThumbsUp, Trash2, Users,
} from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useApp } from './lib/store'
import Overview from './tabs/Overview'
import Viewing from './tabs/Viewing'
import Discovery from './tabs/Discovery'
import Ratings from './tabs/Ratings'
import Profiles from './tabs/Profiles'
import Devices from './tabs/Devices'
import Billing from './tabs/Billing'
import Messages from './tabs/Messages'
import Games from './tabs/Games'
import Account from './tabs/Account'
// import Ask from './tabs/Ask' // Ask tab temporarily disabled; re-enable with the TABS entry below
import Explorer from './components/Explorer'
import Sidebar from './components/Sidebar'
import FileView from './tabs/FileView'
import { fileTabToSlug, isFileTab, type FileTabId } from './lib/files'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'
import { Tabs, TabsContent } from './components/ui/tabs'

export const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/' },
  { id: 'viewing', label: 'Viewing', icon: Clapperboard, path: '/viewing' },
  { id: 'discovery', label: 'Discovery', icon: Compass, path: '/discovery' },
  { id: 'ratings', label: 'Ratings & My List', icon: ThumbsUp, path: '/ratings' },
  { id: 'profiles', label: 'Profiles', icon: Users, path: '/profiles' },
  { id: 'devices', label: 'Devices & locations', icon: MonitorSmartphone, path: '/devices' },
  { id: 'billing', label: 'Billing', icon: Receipt, path: '/billing' },
  { id: 'messages', label: 'Messages & support', icon: MessagesSquare, path: '/messages' },
  { id: 'games', label: 'Games', icon: Gamepad2, path: '/games' },
  { id: 'account', label: 'Account', icon: Settings2, path: '/account' },
  // { id: 'ask', label: 'Ask', icon: MessageCircleQuestion, path: '/ask' }, // temporarily disabled
  { id: 'explorer', label: 'Data explorer', icon: Database, path: '/explorer' },
] as const

export type InsightTabId = (typeof TABS)[number]['id']
export type TabId = InsightTabId | FileTabId

export default function App({ tab }: { tab: TabId }) {
  const loaded = useApp((s) => s.loaded)
  const accountName = useApp((s) => s.accountName)
  const loadFolder = useApp((s) => s.loadFolder)
  const reset = useApp((s) => s.reset)
  const router = useRouter()
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  // Mount each panel on first visit, then keep it mounted: revisits are free,
  // but unvisited tabs cost nothing on initial load.
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set<TabId>([tab]))
  function selectTab(value: TabId) {
    setVisited((prev) => (prev.has(value) ? prev : new Set(prev).add(value)))
    setMenuOpen(false)
    if (isFileTab(value)) {
      void router.navigate({ to: '/file/$name', params: { name: fileTabToSlug(value) } })
      return
    }
    const path = TABS.find((t) => t.id === value)?.path ?? '/'
    void router.navigate({ to: path })
  }
  useEffect(() => {
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)))
  }, [tab])
  // Hover/keyboard focus starts the route loader early, so the tab's files
  // are already parsing before the click lands.
  function preloadTab(path: (typeof TABS)[number]['path']) {
    void router.preloadRoute({ to: path })
  }
  function hoverTab(path: string) {
    const match = TABS.find((t) => t.path === path)
    if (match) preloadTab(match.path)
  }
  function hoverFile(slug: string) {
    void router.preloadRoute({ to: '/file/$name', params: { name: slug } })
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const [light, setLight] = useState(() => {
    try {
      return localStorage.getItem('theme') === 'light'
    } catch {
      return false
    }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', !light)
    try {
      localStorage.setItem('theme', light ? 'light' : 'dark')
    } catch {
      /* private mode */
    }
  }, [light])

  async function importFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    try {
      await loadFolder(files)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this export. Select the extracted Netflix export folder again.')
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center justify-between gap-4 px-6 md:px-10">
        <span className="flex items-center gap-3">
          {loaded && (
            <Button
              variant="bugatti"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-4" aria-hidden="true" />
            </Button>
          )}
          <span className="nav-link text-subtle">Private</span>
        </span>
        <span className="wordmark">Netflix Insights</span>
        <span className="flex items-center gap-4">
          <span className="nav-link text-subtle">
            {loaded && accountName ? accountName.toUpperCase() : 'Local'}
          </span>
          <Button
            variant="bugatti"
            size="icon-sm"
            onClick={() => setLight((v) => !v)}
            aria-pressed={light}
            aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
            title={light ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {light ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
          </Button>
        </span>
      </header>

      <div className="flex items-start">
        {loaded && (
          <Sidebar
            tabs={TABS}
            tab={tab}
            onNavigate={selectTab}
            onHoverInsight={hoverTab}
            onHoverFile={hoverFile}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
          />
        )}
        <main className="mx-auto w-full min-w-0 max-w-[1840px] flex-1 px-6 pb-30 md:px-10">
          {loaded && (
            <div className="mb-16 flex justify-end">
              <Button variant="bugatti" size="pill-sm" onClick={() => { reset(); setVisited(new Set<TabId>(['overview'])); void router.navigate({ to: '/' }) }}>
                <Trash2 className="size-4" aria-hidden="true" data-icon="inline-start" />
                Clear export
              </Button>
            </div>
          )}
          {error && (
            <Alert variant="destructive" className="mb-16 rounded-none border-warning bg-transparent">
              <AlertTitle className="font-mono text-xs tracking-[2px] uppercase">Import failed</AlertTitle>
              <AlertDescription className="font-body text-base">{error}</AlertDescription>
            </Alert>
          )}
          {loaded ? (
            <Tabs value={tab}>
              <TabsContent value="overview" keepMounted>{visited.has('overview') && <Overview />}</TabsContent>
              <TabsContent value="viewing" keepMounted>{visited.has('viewing') && <Viewing />}</TabsContent>
              <TabsContent value="discovery" keepMounted>{visited.has('discovery') && <Discovery />}</TabsContent>
              <TabsContent value="ratings" keepMounted>{visited.has('ratings') && <Ratings />}</TabsContent>
              <TabsContent value="profiles" keepMounted>{visited.has('profiles') && <Profiles />}</TabsContent>
              <TabsContent value="devices" keepMounted>{visited.has('devices') && <Devices />}</TabsContent>
              <TabsContent value="billing" keepMounted>{visited.has('billing') && <Billing />}</TabsContent>
              <TabsContent value="messages" keepMounted>{visited.has('messages') && <Messages />}</TabsContent>
              <TabsContent value="games" keepMounted>{visited.has('games') && <Games />}</TabsContent>
              <TabsContent value="account" keepMounted>{visited.has('account') && <Account />}</TabsContent>
              {/* <TabsContent value="ask" keepMounted>{visited.has('ask') && <Ask />}</TabsContent> */} {/* temporarily disabled */}
              <TabsContent value="explorer" keepMounted>{visited.has('explorer') && <Explorer />}</TabsContent>
              {isFileTab(tab) && (
                <TabsContent value={tab} keepMounted>
                  {visited.has(tab) && <FileView slug={fileTabToSlug(tab)} />}
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <section className="mx-auto max-w-3xl py-24 text-center md:py-36">
              <p className="caption-mono mb-8">A private reading of your export</p>
              <h1 className="display-xl">
                Your viewing history.
                <br />A different perspective.
              </h1>
              <p className="mx-auto my-10 max-w-xl font-body text-lg leading-relaxed text-body">
                Explore your Netflix export privately. Files stay in browser memory, never uploaded or saved by this app.
              </p>
              <Card className="mx-auto max-w-xl rounded-none border-line bg-panel p-4 text-left">
                <CardContent className="space-y-6">
                  <p className="caption-mono">Select your extracted export folder</p>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    {...{ webkitdirectory: '' }}
                    onChange={(event) => void importFiles(event.target.files)}
                    className="sr-only"
                    aria-label="Select Netflix export folder"
                  />
                  <Button variant="bugatti" size="pill" onClick={() => fileRef.current?.click()}>
                    <FolderOpen className="size-4" aria-hidden="true" data-icon="inline-start" />
                    Choose folder
                  </Button>
                </CardContent>
              </Card>
              <p className="caption-mono mt-10">
                Unzip first — reloading clears everything
              </p>
            </section>
          )}
        </main>
      </div>

      <footer className="border-t border-line px-6 py-16 md:px-10">
        <p className="wordmark mb-10 text-center">Netflix Insights</p>
        <p className="caption-mono text-center">Private local analysis — data never leaves this browser</p>
        <p className="mt-6 text-center font-body text-sm text-faint">Reads Netflix Member Information Request exports. Not affiliated with Netflix or Bugatti.</p>
      </footer>
    </div>
  )
}
