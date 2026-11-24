import type { Range } from '@/lib/anchors'

/**
 * A transcript is stored whole, with `[page N]` on its own line where each page begins (Transcription
 * Policy rule 4). The item page uses these markers to show each scan beside its own page of text;
 * the stored transcript never changes.
 */

const MARKER = /^\[page (\d+)\][^\S\n]*$/gm

/**
 * Where each page's text begins and ends, in characters. Null unless the markers run 1, 2, 3 … in
 * order. Anything before `[page 1]` belongs to page 1, so together the pages cover the whole text.
 */
export function splitPages(text: string): Range[] | null {
  const starts: number[] = []
  for (const m of text.matchAll(MARKER)) {
    if (Number(m[1]) !== starts.length + 1) return null
    starts.push(m.index)
  }
  if (!starts.length) return null
  starts[0] = 0
  return starts.map((start, i) => ({ start, end: i + 1 < starts.length ? starts[i + 1] : text.length }))
}

export type Piece = { text: string; id?: number; first: boolean; last: boolean }

/**
 * Sorts the transcript's segments (plain text, or an annotated passage with its id) into pages. A
 * passage that runs over a page break is cut in two; `first` and `last` say which part is which, so
 * the passage's anchor goes on its first part and its note number on its last.
 */
export function piecesByPage(segments: { text: string; id?: number }[], pages: Range[]): Piece[][] {
  const out: Piece[][] = pages.map(() => [])
  let pos = 0
  for (const s of segments) {
    const start = pos
    const end = pos + s.text.length
    pos = end
    pages.forEach((p, k) => {
      const a = Math.max(start, p.start)
      const b = Math.min(end, p.end)
      if (a >= b) return
      out[k].push({ text: s.text.slice(a - start, b - start), id: s.id, first: a === start, last: b === end })
    })
  }
  return out
}
