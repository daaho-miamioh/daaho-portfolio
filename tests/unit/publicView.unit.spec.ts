import { describe, expect, it } from 'vitest'

import { hiddenParts, neutralTitle, publicSearchText, stripForPublic } from '@/lib/publicView'

const draft = {
  itemId: 'AAMU-0061',
  title: 'Letter to R. M. Hughes from Ching W. Hwang, 29 October 1923',
  date: '1923-10-29',
  dateSort: '1923-10-29',
  description: 'AI description',
  transcript: 'AI transcript with secretword',
  people: [{ person: 1, role: 'creator' }],
  places: [2],
  subjects: [3],
  genres: [4],
  archival: { type: 'Text', creator: 'Huang, Chin-Wu' },
  translation: { text: 'AI translation', status: 'ai' },
  review: { notes: 'internal' },
  ai: { model: 'x' },
  importIssues: [{ message: 'x' }],
}

describe('public view of an item', () => {
  it('hides every unchecked part, and staff notes, from the public', () => {
    const p = stripForPublic(draft)
    expect(p.title).toBe('AAMU-0061 · Text')
    expect(p.date).toBeNull()
    expect(p.dateSort).toBeNull()
    expect(p.description).toBeNull()
    expect(p.transcript).toBeNull()
    expect(p.people).toEqual([])
    expect(p.places).toEqual([])
    expect(p.translation).toBeNull()
    expect('ai' in p).toBe(false)
    expect('importIssues' in p).toBe(false)
    expect(p.review?.notes).toBeNull()
    // The library's own record stays.
    expect(p.archival).toEqual(draft.archival)
  })

  it('shows each part once it is checked', () => {
    const p = stripForPublic({
      ...draft,
      review: { titleChecked: true, descriptionChecked: true, transcriptChecked: true, linksChecked: true },
      translation: { text: 'Checked translation', status: 'verified' },
    })
    expect(p.title).toBe(draft.title)
    expect(p.date).toBe(draft.date)
    expect(p.transcript).toBe(draft.transcript)
    expect(p.people).toEqual(draft.people)
    expect(p.translation?.text).toBe('Checked translation')
  })

  it('never changes the stored record', () => {
    const copy = structuredClone(draft)
    stripForPublic(draft)
    expect(draft).toEqual(copy)
  })

  it('searches only what the public can read', () => {
    expect(publicSearchText(draft)).not.toContain('secretword')
    expect(publicSearchText(draft)).toContain('Huang, Chin-Wu')
    expect(publicSearchText({ ...draft, review: { transcriptChecked: true } })).toContain('secretword')
  })

  it('names what is still hidden, for staff', () => {
    expect(hiddenParts(draft)).toEqual(['Title and date', 'Description', 'Transcript', 'People, places and subjects', 'English translation'])
    expect(hiddenParts({ ...draft, review: { titleChecked: true, descriptionChecked: true, transcriptChecked: true, linksChecked: true }, translation: null })).toEqual([])
  })

  it('falls back to a plain label when an item has no type', () => {
    expect(neutralTitle({ itemId: 'BC-0698' })).toBe('BC-0698 · Archival item')
  })
})
