import { countBy, orderBy } from 'lodash-es'
import type { Row } from './utils.ts'

/** Chart palette slots for ranked profiles; rank 4+ falls through to the muted token. */
export const PROFILE_VARS = ['--profile-1', '--profile-2', '--profile-3', '--profile-4'] as const
export const PROFILE_OTHER_VAR = '--color-subtle'

/** Profile names ranked by playback-record count, most active first. */
export function rankProfiles(rows: Row[], field = 'Profile Name'): string[] {
  return orderBy(
    Object.entries(countBy(rows, (row) => row[field] || 'Unknown')).map(([name, count]) => ({ name, count })),
    ['count'],
    ['desc'],
  ).map((entry) => entry.name)
}

/** CSS variable for a profile's chart color. Stable: rank 0-3 take the profile
 *  slots, everything else (including unknown names) takes the muted Other slot. */
export function profileColorVar(name: string, ranked: string[]): string {
  const index = ranked.indexOf(name)
  return index >= 0 && index < PROFILE_VARS.length ? `var(${PROFILE_VARS[index]})` : `var(${PROFILE_OTHER_VAR})`
}
