import { describe, expect, it } from 'vitest'

import { displayDate, sortableDate } from '@/lib/dates'

describe('dates', () => {
  it('handles the three precisions the pipeline emits', () => {
    expect(displayDate('1923-10-15')).toBe('October 15, 1923')
    expect(displayDate('1938-01')).toBe('January 1938')
    expect(displayDate('1976')).toBe('1976')
    expect(sortableDate('1938-01')).toBe('1938-01-01')
    expect(sortableDate('1976')).toBe('1976-01-01')
  })

  it('treats a missing date as undated rather than guessing', () => {
    expect(displayDate(null)).toBe('Undated')
    expect(sortableDate(null)).toBeNull()
    expect(sortableDate('circa 1940')).toBeNull()
  })
})
