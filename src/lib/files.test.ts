import { describe, expect, it } from 'vitest'
import { FILE_GROUPS, prettyName, slugify, slugToFile } from './files.ts'
import { KNOWN } from './store.ts'

describe('file groups', () => {
  it('covers every bundled file exactly once', () => {
    const grouped = FILE_GROUPS.flatMap((g) => g.files)
    expect([...grouped].sort()).toEqual([...KNOWN].sort())
  })
})

describe('slugs', () => {
  it('round-trips every bundled file', () => {
    for (const name of KNOWN) expect(slugToFile(slugify(name))).toBe(name)
  })
  it('returns undefined for unknown slugs', () => {
    expect(slugToFile('no-such-file')).toBeUndefined()
  })
})

describe('prettyName', () => {
  it('humanizes camel-case filenames', () => {
    expect(prettyName('ViewingActivity.csv')).toBe('Viewing Activity')
    expect(prettyName('MessagesSentByNetflix.csv')).toBe('Messages Sent By Netflix')
    expect(prettyName('IpAddressesLogin.csv')).toBe('Ip Addresses Login')
    expect(prettyName('ExtraMembers.txt')).toBe('Extra Members')
  })
})
