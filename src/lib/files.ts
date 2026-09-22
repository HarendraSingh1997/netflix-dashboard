import { KNOWN } from './store.ts'

export interface FileGroup {
  folder: string
  files: string[]
}

/** Folder grouping mirrors the HR export layout. Every KNOWN file appears exactly once. */
export const FILE_GROUPS: FileGroup[] = [
  { folder: 'Account', files: ['AccountDetails.csv', 'SubscriptionHistory.csv', 'AccessAndDevices.csv', 'TermsOfUse.csv', 'ExtraMembers.txt'] },
  { folder: 'Clickstream', files: ['Clickstream.csv'] },
  { folder: 'Content Interaction', files: ['ViewingActivity.csv', 'SearchHistory.csv', 'PlaybackRelatedEvents.csv', 'MyList.csv', 'Ratings.csv', 'IndicatedPreferences.csv'] },
  { folder: 'Customer Service', files: ['CSContact.csv', 'ChatTranscripts.csv'] },
  { folder: 'Devices', files: ['Devices.csv'] },
  { folder: 'Games', files: ['GamePlaySession.csv'] },
  { folder: 'IP Addresses', files: ['IpAddressesLogin.csv', 'IpAddressesStreaming.csv', 'IpAddressesAccountCreation.txt'] },
  { folder: 'Messages', files: ['MessagesSentByNetflix.csv'] },
  { folder: 'Payment & Billing', files: ['BillingHistory.csv'] },
  { folder: 'Profiles', files: ['Profiles.csv', 'AvatarHistory.csv', 'ParentalControlsRestrictedTitles.txt'] },
  { folder: 'Surveys', files: ['ProductCancellationSurvey.txt'] },
]

export type FileTabId = `file:${string}`

export function isFileTab(tab: string): tab is FileTabId {
  return tab.startsWith('file:')
}

/** URL-safe slug for /file/$name routes, e.g. ViewingActivity.csv -> viewingactivity-csv */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export function fileTabToSlug(tab: FileTabId): string {
  return tab.slice('file:'.length)
}

export function slugToFile(slug: string): string | undefined {
  return KNOWN.find((name) => slugify(name) === slug)
}

/** Human label, e.g. ViewingActivity.csv -> Viewing Activity */
export function prettyName(name: string): string {
  return name
    .replace(/\.(csv|txt)$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}
