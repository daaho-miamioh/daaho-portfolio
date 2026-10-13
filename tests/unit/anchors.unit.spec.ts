import { describe, expect, it } from 'vitest'

import { contextAround, locate, segment } from '@/lib/anchors'

const transcript = '[page 1]\nDear Mr. Hughes:\n\nI thot that Mr. Huang (chinaman) would call in Sept. as he promised.'

function anchorFor(text: string, quote: string) {
  const start = text.indexOf(quote)
  return { quote, start, ...contextAround(text, start, start + quote.length) }
}

describe('locate', () => {
  it('finds the passage at its recorded offset', () => {
    const a = anchorFor(transcript, 'Mr. Huang')
    expect(locate(transcript, a)).toEqual({ start: a.start, end: a.start + 'Mr. Huang'.length })
  })

  it('finds it again after the transcript is corrected earlier on', () => {
    const a = anchorFor(transcript, 'Mr. Huang')
    const corrected = transcript.replace('I thot that', 'I thot [thought] that')
    const r = locate(corrected, a)!
    expect(corrected.slice(r.start, r.end)).toBe('Mr. Huang')
  })

  it('picks the right occurrence when the quote appears twice', () => {
    const text = 'Mr. Smith wrote. Later, Mr. Smith replied.'
    const a = anchorFor(text, 'Mr. Smith')
    const second = { ...a, start: text.lastIndexOf('Mr. Smith'), ...contextAround(text, text.lastIndexOf('Mr. Smith'), text.lastIndexOf('Mr. Smith') + 9) }
    const shifted = 'NOTE. ' + text
    const r = locate(shifted, second)!
    expect(r.start).toBe(shifted.lastIndexOf('Mr. Smith'))
  })

  it('returns null when the passage is gone, rather than guessing', () => {
    const a = anchorFor(transcript, 'Mr. Huang')
    expect(locate(transcript.replace('Mr. Huang', 'Mr. Hsiang'), a)).toBeNull()
  })
})

describe('segment', () => {
  it('splits text into plain and annotated runs', () => {
    const { segments } = segment('abcdef', [{ id: 1, start: 2, end: 4 }])
    expect(segments).toEqual([{ text: 'ab' }, { text: 'cd', id: 1 }, { text: 'ef' }])
  })

  it('reports an overlapping annotation instead of mangling the text', () => {
    const { segments, unplaced } = segment('abcdef', [{ id: 1, start: 1, end: 4 }, { id: 2, start: 3, end: 5 }])
    expect(segments.map((s) => s.text).join('')).toBe('abcdef')
    expect(unplaced).toEqual([2])
  })
})
