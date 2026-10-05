import { describe, expect, it } from 'vitest'

import { eventsForItem, yearOf, type ContextEvent } from '@/lib/context'
import { detectRegions } from '@/lib/regions'

describe('detectRegions', () => {
  it('reads the country from the description when the place is Ohio', () => {
    expect(
      detectRegions({
        title: 'Letter to Mr. Chin-wa Huang thanking him for tea, 24 April 1925',
        description: 'The sender thanks Huang, a Chinese student at Miami University, for a present of tea.',
        places: ['Ohio--Oxford'],
      }),
    ).toEqual(['China'])
  })

  it('reads place headings, subjects and language too', () => {
    expect(detectRegions({ places: ['Japan--Kōbe-shi'] })).toEqual(['Japan'])
    expect(detectRegions({ subjects: ['Thai students'] })).toEqual(['Thailand'])
    expect(detectRegions({ language: 'English and Chinese' })).toEqual(['China'])
  })

  it('finds several regions, and none in an unrelated item', () => {
    expect(detectRegions({ description: 'A Filipino student writes from Manila about Japanese troops.' })).toEqual(['Japan', 'Philippines'])
    expect(detectRegions({ title: 'Memorandum on the Cabinet meeting, 1977', places: ['Ohio--Oxford'] })).toEqual([])
  })

  it('does not match inside other words', () => {
    expect(detectRegions({ description: 'The Thaiss family; a chinaware set.' })).toEqual([])
  })
})

const ev = (id: number, startYear: number, extra: Partial<ContextEvent> = {}): ContextEvent => ({
  id, startYear, regions: ['China'], importance: 'major', ...extra,
})

describe('eventsForItem', () => {
  const bridge = ev(1, 1937) // Marco Polo Bridge Incident
  const war = ev(2, 1937, { endYear: 1945 }) // Second Sino-Japanese War
  const exclusion = ev(3, 1882, { endYear: 1943 }) // Chinese Exclusion era
  const korea = ev(4, 1937, { regions: ['Korea'] })
  const minor = ev(5, 1937, { importance: 'notable' })

  it('shows the event of that year before the periods it falls in', () => {
    expect(eventsForItem({ year: 1937, regions: ['China'] }, [exclusion, war, minor, bridge]).map((e) => e.id)).toEqual([1, 5, 2])
  })

  it('only shows events for the regions the item concerns', () => {
    expect(eventsForItem({ year: 1937, regions: ['China'] }, [korea]).map((e) => e.id)).toEqual([])
  })

  it('shows a period in later years of its span', () => {
    expect(eventsForItem({ year: 1941, regions: ['China'] }, [bridge, war, exclusion]).map((e) => e.id)).toEqual([2, 3])
  })

  it('shows nothing for an undated item or one with no region', () => {
    expect(eventsForItem({ year: null, regions: ['China'] }, [bridge])).toEqual([])
    expect(eventsForItem({ year: 1937, regions: [] }, [bridge])).toEqual([])
  })

  it('puts events an editor pinned first, and can hide the automatic ones', () => {
    const pinned = ev(9, 1950, { regions: ['Korea'] })
    expect(eventsForItem({ year: 1937, regions: ['China'], pinned: [pinned] }, [bridge]).map((e) => e.id)).toEqual([9, 1])
    expect(eventsForItem({ year: 1937, regions: ['China'], pinned: [pinned], hideAutomatic: true }, [bridge]).map((e) => e.id)).toEqual([9])
  })

  it('reads the year from a sortable date', () => {
    expect(yearOf('1937-07-01T00:00:00.000Z')).toBe(1937)
    expect(yearOf(null)).toBeNull()
  })
})
