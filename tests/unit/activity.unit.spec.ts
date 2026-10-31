import { describe, expect, it } from 'vitest'

import { changesBetween, snapshot, titleOf } from '@/lib/activity'

describe('changesBetween', () => {
  it('lists the fields that differ, inside groups by dotted path', () => {
    const before = { id: 1, title: 'Letter', review: { title: false, date: false }, updatedAt: '2026-10-01' }
    const after = { id: 1, title: 'Letter to Upham', review: { title: true, date: false }, updatedAt: '2026-10-31' }
    expect(changesBetween(before, after)).toEqual({
      title: { from: 'Letter', to: 'Letter to Upham' },
      'review.title': { from: false, to: true },
    })
  })

  it('treats a fetched record and its ID as the same, and empty values as equal', () => {
    const before = { set: 3, rights: null, names: [] }
    const after = { set: { id: 3, title: 'Race at Miami', createdAt: '2026-10-30' }, rights: '', names: null }
    expect(changesBetween(before, after)).toEqual({})
  })

  it('compares rows of a list one by one when their number is unchanged, and counts them when not', () => {
    const before = { names: [{ id: 'a', person: 7, role: 'author' }], pages: [{ id: 'p1', image: 1 }] }
    const after = { names: [{ id: 'a', person: 7, role: 'recipient' }], pages: [{ id: 'p1', image: 1 }, { id: 'p2', image: 2 }] }
    expect(changesBetween(before, after)).toEqual({
      'names.1.role': { from: 'author', to: 'recipient' },
      pages: { from: '1 entry', to: '2 entries' },
    })
  })

  it('shows rich text as its words', () => {
    const text = (t: string) => ({ root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: t }] }] } })
    expect(changesBetween({ intro: text('Old') }, { intro: text('New') })).toEqual({ intro: { from: 'Old', to: 'New' } })
  })

  it('shows a long text from just before where it changed', () => {
    const base = 'x'.repeat(500)
    const { transcript } = changesBetween({ transcript: base }, { transcript: `${base.slice(0, 300)}CHANGED${base.slice(300)}` })
    expect(transcript.to).toMatch(/^…x{60}CHANGED/)
    expect(String(transcript.to).length).toBeLessThanOrEqual(202)
  })

  it('never records secrets, and ignores fields the newer version does not have', () => {
    const before = { name: 'Ann', hash: 'abc', salt: 'def', email: 'a@x.edu' }
    const after = { name: 'Ann', hash: 'xyz', resetPasswordToken: 't' }
    expect(changesBetween(before, after)).toEqual({})
  })

  it('skips the fields it is told nobody sees', () => {
    expect(changesBetween({ publicText: 'a', title: 'A' }, { publicText: 'b', title: 'A' }, new Set(['publicText']))).toEqual({})
  })
})

describe('snapshot', () => {
  it('keeps what a deleted record held, without bookkeeping or empty fields', () => {
    expect(snapshot({ id: 4, name: 'Oxford', authorityUri: null, createdAt: '2026-01-01' })).toEqual({ name: { from: 'Oxford', to: null } })
  })
})

describe('titleOf', () => {
  it('names a record by its title field, after its item ID', () => {
    expect(titleOf({ id: 9, itemId: 'AAMU-0001', title: 'Letter  to\nUpham' }, 'title')).toBe('AAMU-0001 · Letter to Upham')
    expect(titleOf({ id: 2, filename: 'scan.jpg' })).toBe('scan.jpg')
    expect(titleOf({ id: 5 })).toBe('#5')
  })
})
