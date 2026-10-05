import { describe, expect, it } from 'vitest'

import { relatedItems, type Linkable } from '@/lib/related'

const item = (id: number, links: Partial<Omit<Linkable, 'id'>> = {}): Linkable => ({
  id, people: [], subjects: [], places: [], genres: [], ...links,
})

// A collection shaped like the batch: one place on nearly everything (Ohio--Oxford, id 1).
const filler = Array.from({ length: 20 }, (_, i) => item(100 + i, { places: [1] }))

describe('relatedItems', () => {
  it('ignores a term carried by most items, however many items share it', () => {
    const a = item(1, { places: [1] })
    const b = item(2, { places: [1] })
    expect(relatedItems(a, [a, b, ...filler])).toEqual([])
  })

  it('ranks a shared person above a shared subject above a shared place', () => {
    const a = item(1, { people: [7], subjects: [8], places: [9] })
    const byPerson = item(2, { people: [7] })
    const bySubject = item(3, { subjects: [8] })
    const byPlace = item(4, { places: [9] })
    const ranked = relatedItems(a, [a, byPlace, bySubject, byPerson, ...filler]).map((r) => r.id)
    expect(ranked).toEqual([2, 3, 4])
  })

  it('counts a rare shared term for more than a common one', () => {
    const a = item(1, { subjects: [50, 51] })
    const rare = item(2, { subjects: [50] }) // only a and rare carry 50
    const common = [3, 4, 5].map((id) => item(id, { subjects: [51] })) // 51 on four items
    const [first] = relatedItems(a, [a, rare, ...common, ...filler])
    expect(first.id).toBe(2)
  })

  it('says why: the shared links are returned', () => {
    const a = item(1, { people: [7], subjects: [8] })
    const b = item(2, { people: [7], subjects: [8] })
    expect(relatedItems(a, [a, b, ...filler])[0].shared).toEqual([
      { kind: 'people', id: 7 },
      { kind: 'subjects', id: 8 },
    ])
  })

  it('never lists the item itself, and respects the limit', () => {
    const a = item(1, { people: [7] })
    const others = Array.from({ length: 10 }, (_, i) => item(i + 2, { people: [7] }))
    const result = relatedItems(a, [a, ...others], { limit: 6, hubShare: 1 })
    expect(result).toHaveLength(6)
    expect(result.map((r) => r.id)).not.toContain(1)
  })

  it('does not treat everything as a hub in a tiny collection', () => {
    const a = item(1, { people: [7] })
    const b = item(2, { people: [7] })
    expect(relatedItems(a, [a, b]).map((r) => r.id)).toEqual([2])
  })
})
