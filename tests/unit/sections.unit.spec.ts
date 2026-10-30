import { describe, expect, it } from 'vitest'

import { sectionOf, tabOf } from '@/lib/sections'

const section = (path: string) => sectionOf(path)?.label
const tab = (path: string) => {
  const s = sectionOf(path)
  return s && tabOf(s, path)
}

describe('sectionOf', () => {
  it('puts the ways into the documents under Collection', () => {
    for (const p of ['/collection', '/items', '/items/aamu-0045', '/people/chin-wu-huang', '/timeline', '/genres/correspondence']) {
      expect(section(p)).toBe('Collection')
    }
  })

  it('puts the project pages under About', () => {
    for (const p of ['/about', '/about/team', '/events', '/events/some-talk', '/harmful-language']) expect(section(p)).toBe('About')
  })

  it('keeps Stories on its own, and leaves the home page and staff pages out', () => {
    expect(section('/stories/chin-wu-huang')).toBe('Stories')
    expect(section('/')).toBeUndefined()
    expect(section('/review/people')).toBeUndefined()
  })

  it('does not take a path that only starts with the same letters', () => {
    expect(section('/itemsx')).toBeUndefined()
    expect(section('/aboutus')).toBeUndefined()
  })
})

describe('tabOf', () => {
  it('chooses the most specific tab', () => {
    expect(tab('/about')).toBe('/about')
    expect(tab('/about/team')).toBe('/about/team')
  })

  it('marks the tab an inner page comes under, and none for a page without one', () => {
    expect(tab('/items/aamu-0045')).toBe('/items')
    expect(tab('/genres/correspondence')).toBeUndefined()
  })
})
