import { describe, expect, it } from 'vitest'

import { buildItemsWhere, decadeOptions, filterHref, readFilters } from '@/lib/itemsQuery'

describe('readFilters', () => {
  it('keeps known filters and drops malformed decades', () => {
    expect(readFilters({ q: '  Upham ', decade: '1930s', place: 'japan-tokyo' })).toEqual({
      q: 'Upham', decade: '1930s', place: 'japan-tokyo', subject: undefined, genre: undefined,
    })
    expect(readFilters({ decade: 'last week' }).decade).toBeUndefined()
    expect(readFilters({ decade: 'undated' }).decade).toBe('undated')
  })
})

describe('buildItemsWhere', () => {
  it('searches title, description and transcript', () => {
    expect(buildItemsWhere({ q: 'Hasegawa' }, {})).toEqual({
      and: [{ or: [{ title: { like: 'Hasegawa' } }, { description: { like: 'Hasegawa' } }, { transcript: { like: 'Hasegawa' } }] }],
    })
  })

  it('turns a decade into a date range, and "undated" into a missing date', () => {
    expect(buildItemsWhere({ decade: '1930s' }, {})).toEqual({
      and: [{ dateSort: { greater_than_equal: '1930-01-01' } }, { dateSort: { less_than: '1940-01-01' } }],
    })
    expect(buildItemsWhere({ decade: 'undated' }, {})).toEqual({ and: [{ dateSort: { exists: false } }] })
  })

  it('filters by the resolved id of a place, subject or genre', () => {
    expect(buildItemsWhere({ place: 'japan-tokyo' }, { place: 12 })).toEqual({ and: [{ places: { in: [12] } }] })
  })

  it('makes an unknown slug match nothing rather than everything', () => {
    expect(buildItemsWhere({ subject: 'no-such-subject' }, {})).toEqual({ and: [{ subjects: { in: [-1] } }] })
  })

  it('applies no filter when none is given', () => {
    expect(buildItemsWhere({}, {})).toBeUndefined()
  })
})

describe('decadeOptions', () => {
  it('counts decades in order, undated last', () => {
    expect(decadeOptions(['1938-01-01', null, '1931-05-02', '1923-10-15'])).toEqual([
      { value: '1920s', label: '1920s', count: 1 },
      { value: '1930s', label: '1930s', count: 2 },
      { value: 'undated', label: 'Undated', count: 1 },
    ])
  })
})

describe('filterHref', () => {
  it('keeps filters across pages', () => {
    expect(filterHref('/items', { q: 'tea', decade: '1920s' }, 2)).toBe('/items?q=tea&decade=1920s&page=2')
    expect(filterHref('/items', {}, 1)).toBe('/items')
  })
})
