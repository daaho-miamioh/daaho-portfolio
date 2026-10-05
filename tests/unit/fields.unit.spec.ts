import { describe, expect, it } from 'vitest'

import { asList } from '@/lib/fields'

describe('asList', () => {
  it('splits one string holding several place headings (13 such values in the batch)', () => {
    expect(asList('Ohio--Oxford; District of Columbia--Washington')).toEqual([
      'Ohio--Oxford',
      'District of Columbia--Washington',
    ])
  })

  it('accepts arrays, single values and nothing', () => {
    expect(asList(['a', ' b '])).toEqual(['a', 'b'])
    expect(asList('Ohio--Oxford')).toEqual(['Ohio--Oxford'])
    expect(asList(null)).toEqual([])
    expect(asList('')).toEqual([])
  })
})
