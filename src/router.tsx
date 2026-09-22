import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TABS, type TabId } from './App'
import { useApp } from './lib/store'
import { NotFound, Root } from './shell'

// Source files each tab reads lazily. Route loaders ensure (and therefore
// pre-parse) them, so hovering a tab starts its data load before the click.
const TAB_FILES: Record<TabId, string[]> = {
  overview: ['ViewingActivity.csv', 'Profiles.csv', 'BillingHistory.csv', 'Devices.csv', 'AccountDetails.csv'],
  viewing: ['ViewingActivity.csv'],
  discovery: ['SearchHistory.csv'],
  ratings: ['Ratings.csv', 'MyList.csv'],
  profiles: ['Profiles.csv', 'ViewingActivity.csv'],
  devices: ['Devices.csv', 'IpAddressesLogin.csv', 'IpAddressesStreaming.csv', 'AccessAndDevices.csv'],
  billing: ['BillingHistory.csv', 'SubscriptionHistory.csv'],
  messages: ['MessagesSentByNetflix.csv', 'ChatTranscripts.csv', 'CSContact.csv'],
  games: ['GamePlaySession.csv'],
  account: ['AccountDetails.csv', 'TermsOfUse.csv'],
  ask: [],
  explorer: ['ViewingActivity.csv'],
}

async function preloadTabFiles(names: string[]) {
  const state = useApp.getState()
  if (!state.loaded) return
  await Promise.all(names.map((name) => state.ensureFile(name)))
}

const rootRoute = createRootRoute({ component: Root, notFoundComponent: NotFound })

const tabRoutes = TABS.map((t) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: t.path,
    loader: () => preloadTabFiles(TAB_FILES[t.id]),
  }),
)

const routeTree = rootRoute.addChildren(tabRoutes)

export const router = createRouter({ routeTree, history: createHashHistory() })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
