import { describe, expect, it } from 'vitest'
import { combinedRegions } from './analytics'
import type { Row } from './store'

const s = (display: string, code = ''): Row => ({ 'Region Code Display Name': display, 'Region Code': code })
const l = (code: string, display = ''): Row => ({ 'Region Code Display Name': display, 'Region Code': code })

describe('combinedRegions', () => {
  it('merges a region present in both lists into one summed row', () => {
    const out = combinedRegions([s('Karnataka'), s('Karnataka')], [l('KA', 'Karnataka')])
    expect(out).toEqual([{ name: 'Karnataka', value: 3 }])
  })

  it('keeps streaming-only and login-only regions with their own counts', () => {
    const out = combinedRegions([s('Goa')], [l('MH', 'Maharashtra')])
    expect(out).toEqual([
      { name: 'Goa', value: 1 },
      { name: 'Maharashtra', value: 1 },
    ])
  })

  it('falls back to Region Code and drops blank rows', () => {
    const out = combinedRegions([s('', 'DL')], [{ 'Region Code Display Name': '', 'Region Code': '' }])
    expect(out).toEqual([{ name: 'DL', value: 1 }])
  })

  it('orders value-descending', () => {
    const out = combinedRegions([s('B'), s('A'), s('A')], [])
    expect(out.map((r) => r.name)).toEqual(['A', 'B'])
  })

  it('returns [] for empty inputs', () => {
    expect(combinedRegions([], [])).toEqual([])
  })
})
