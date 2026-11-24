import { describe, expect, it } from 'vitest'

import { piecesByPage, splitPages } from '@/lib/transcriptPages'

const text = '[page 1]\nDear Sir,\n\n[page 2]\nYours truly,\n[page 3]\nP.S.'

describe('splitting a transcript into its pages', () => {
  it('finds each page by its marker, and the pages cover the whole text', () => {
    const pages = splitPages(text)!
    expect(pages.map((p) => text.slice(p.start, p.end))).toEqual(['[page 1]\nDear Sir,\n\n', '[page 2]\nYours truly,\n', '[page 3]\nP.S.'])
  })
  it('gives page 1 anything before its marker', () => {
    const pages = splitPages('Stamp\n[page 1]\nA\n[page 2]\nB')!
    expect(pages[0]).toEqual({ start: 0, end: 'Stamp\n[page 1]\nA\n'.length })
  })
  it('refuses markers out of order, missing, or not on their own line', () => {
    expect(splitPages('[page 1]\nA\n[page 3]\nB')).toBeNull()
    expect(splitPages('no markers here')).toBeNull()
    expect(splitPages('[page 1]\nsee [page 2] below')).toEqual([{ start: 0, end: 'see [page 2] below'.length + 9 }])
  })
})

describe('sorting annotated text into pages', () => {
  it('cuts a passage that runs over a page break, marking its first and last parts', () => {
    const pages = splitPages(text)!
    const cut = text.indexOf('Sir')
    const end = text.indexOf('truly')
    const segments = [{ text: text.slice(0, cut) }, { text: text.slice(cut, end), id: 7 }, { text: text.slice(end) }]
    const byPage = piecesByPage(segments, pages)
    expect(byPage.map((ps) => ps.map((p) => p.text).join(''))).toEqual(pages.map((p) => text.slice(p.start, p.end)))
    const parts = byPage.flat().filter((p) => p.id === 7)
    expect(parts.map((p) => [p.text, p.first, p.last])).toEqual([
      ['Sir,\n\n', true, false],
      ['[page 2]\nYours ', false, true],
    ])
  })
})
