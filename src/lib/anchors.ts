/**
 * Where an annotation sits in a transcript.
 *
 * An annotation stores the passage it was attached to plus a little text either side (the W3C Web
 * Annotation model's text-quote selector) as well as the character offset at the time. Offsets alone
 * break the moment a transcript is corrected; the quote and its context find the passage again. If it
 * cannot be found at all, the annotation is reported for re-anchoring rather than placed somewhere wrong.
 */

export type Anchor = { quote: string; prefix?: string | null; suffix?: string | null; start?: number | null }
export type Range = { start: number; end: number }

const CONTEXT = 32

export function contextAround(text: string, start: number, end: number, n = CONTEXT) {
  return { prefix: text.slice(Math.max(0, start - n), start), suffix: text.slice(end, end + n) }
}

function sharedSuffixLength(a: string, b: string) {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}
function sharedPrefixLength(a: string, b: string) {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

export function locate(text: string, anchor: Anchor): Range | null {
  const { quote } = anchor
  if (!quote || !text) return null
  const start = anchor.start ?? -1
  if (start >= 0 && text.slice(start, start + quote.length) === quote) return { start, end: start + quote.length }

  let best: { at: number; score: number } | null = null
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    const before = text.slice(Math.max(0, at - CONTEXT), at)
    const after = text.slice(at + quote.length, at + quote.length + CONTEXT)
    // Context agreement decides; distance from the old offset only breaks ties.
    const score =
      sharedSuffixLength(before, anchor.prefix ?? '') + sharedPrefixLength(after, anchor.suffix ?? '') -
      (start >= 0 ? Math.abs(at - start) / 1e6 : 0)
    if (!best || score > best.score) best = { at, score }
  }
  return best ? { start: best.at, end: best.at + quote.length } : null
}

export type Segment = { text: string; id?: number }

/**
 * Split a transcript into plain and annotated runs. Overlapping annotations cannot both be
 * highlighted in flat text; the earlier one is, and the later is returned in `unplaced` so it can
 * still be listed.
 */
export function segment(text: string, spans: (Range & { id: number })[]): { segments: Segment[]; unplaced: number[] } {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end)
  const segments: Segment[] = []
  const unplaced: number[] = []
  let cursor = 0
  for (const s of sorted) {
    if (s.start < cursor || s.end <= s.start || s.end > text.length) {
      unplaced.push(s.id)
      continue
    }
    if (s.start > cursor) segments.push({ text: text.slice(cursor, s.start) })
    segments.push({ text: text.slice(s.start, s.end), id: s.id })
    cursor = s.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) })
  return { segments, unplaced }
}
