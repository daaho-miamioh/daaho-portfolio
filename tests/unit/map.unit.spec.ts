import { describe, expect, it } from 'vitest'

import { validMapDate, validMapDimensions, validMapExtent } from '@/lib/map'

describe('Mini MAP field formats', () => {
  it('accepts ISO dates and en-dash ranges, and rejects the rest', () => {
    for (const ok of ['', null, '1937', '1937-11', '1937-11-26', '1910–1920', '1988-09–1991']) expect(validMapDate(ok)).toBe(true)
    for (const bad of ['ca. 1940', '1940s', '26 November 1937', '1937-13', '1910-1920']) expect(validMapDate(bad)).not.toBe(true)
  })
  it('wants a number and a unit that agree', () => {
    for (const ok of ['1 page', '2 pages', '1 leaf', '3 leaves', '46 minutes', '1 minute']) expect(validMapExtent(ok)).toBe(true)
    expect(validMapExtent('2 page')).toBe('Write 2 pages.')
    expect(validMapExtent('1 pages')).toBe('Write 1 page.')
    expect(validMapExtent('About 15 minutes')).not.toBe(true)
  })
  it('wants height x width with cm on each', () => {
    expect(validMapDimensions('28 cm x 21.5 cm')).toBe(true)
    expect(validMapDimensions('28 x 21.5 cm')).not.toBe(true)
    expect(validMapDimensions('28.5 x 21.5')).not.toBe(true)
  })
})
