import { describe, expect, it } from 'vitest'
import { profileColorVar, rankProfiles } from './profiles.ts'
import type { Row } from './utils.ts'

const rows: Row[] = [
  { 'Profile Name': 'Harry' }, { 'Profile Name': 'Harry' }, { 'Profile Name': 'Harry' },
  { 'Profile Name': 'KB' }, { 'Profile Name': 'KB' },
  { 'Profile Name': 'Daksh' },
  { 'Profile Name': 'PS' },
  { 'Profile Name': 'A' },
  { 'Profile Name': '' },
]

describe('rankProfiles', () => {
  it('ranks by record count, most active first', () => {
    expect(rankProfiles(rows)).toEqual(['Harry', 'KB', 'Daksh', 'PS', 'A', 'Unknown'])
  })
  it('returns empty for no rows', () => {
    expect(rankProfiles([])).toEqual([])
  })
})

describe('profileColorVar', () => {
  const ranked = ['Harry', 'KB', 'Daksh', 'PS', 'A']
  it('maps the top four ranks to the profile slots', () => {
    expect(profileColorVar('Harry', ranked)).toBe('var(--profile-1)')
    expect(profileColorVar('KB', ranked)).toBe('var(--profile-2)')
    expect(profileColorVar('Daksh', ranked)).toBe('var(--profile-3)')
    expect(profileColorVar('PS', ranked)).toBe('var(--profile-4)')
  })
  it('sends rank five and unknown names to the muted slot', () => {
    expect(profileColorVar('A', ranked)).toBe('var(--color-subtle)')
    expect(profileColorVar('Nobody', ranked)).toBe('var(--color-subtle)')
  })
  it('matches long and colon-containing profile names exactly', () => {
    const long = 'Everyone: The Main Family Entertainment Collection'
    const named = ['Harry', 'KB', long]
    expect(profileColorVar(long, named)).toBe('var(--profile-3)')
    expect(profileColorVar('Harry: Kid', ['Harry: Kid'])).toBe('var(--profile-1)')
  })
})
