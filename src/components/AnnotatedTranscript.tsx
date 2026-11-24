import type { ReactNode } from 'react'

import { ANNOTATION_CATEGORIES } from '@/collections/Annotations'
import { locate, segment } from '@/lib/anchors'
import { piecesByPage, splitPages, type Piece } from '@/lib/transcriptPages'
import type { Annotation } from '@/payload-types'

const CATEGORY = Object.fromEntries(ANNOTATION_CATEGORIES.map((c) => [c.value, c.label]))

/** A time at the start of a line, as recording transcripts mark them: 00:12:05. */
const TIME = /(^|\n)(\d{1,2}):(\d{2}):(\d{2})(?=\s|$)/g

/** Plain text with each time made a link that plays the recording from there (see RecordingPlayer). */
function withTimes(text: string, key: number): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TIME)) {
    const start = m.index + m[1].length
    const end = m.index + m[0].length
    const seconds = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4])
    out.push(text.slice(last, start))
    out.push(
      <a key={`${key}-${start}`} className="timestamp" href={`#t=${seconds}`} data-seek={seconds}>
        <span className="visually-hidden" data-skip="">
          Play from{' '}
        </span>
        {text.slice(start, end)}
      </a>,
    )
    last = end
  }
  out.push(text.slice(last))
  return out
}

/**
 * A transcript with its approved annotations: each annotated passage is highlighted and numbered,
 * and the notes follow in an ordered list, linked both ways. Pass approved annotations only. With
 * `seekable`, the times in it play the recording on the page from that point.
 *
 * With `pageFigures`, one scan per `[page N]` marker, each page of text sits beside its scan. The
 * scans are marked data-skip and the text runs in order, so selections and offsets still count the
 * stored transcript exactly. `data-view="text"` on the same element (TranscriptView) hides the
 * scans and shows the text as one block.
 */
export function AnnotatedTranscript({
  text,
  annotations,
  lang,
  seekable,
  id,
  pageFigures,
}: {
  text: string
  annotations: Annotation[]
  lang?: string
  seekable?: boolean
  /** For the visitors' note form (SuggestAnnotation), which reads selections inside it. */
  id?: string
  pageFigures?: ReactNode[]
}) {
  const ranges = new Map<number, { start: number; end: number }>()
  for (const a of annotations) {
    const r = locate(text, a)
    if (r) ranges.set(a.id, r)
  }
  const { segments, unplaced } = segment(text, [...ranges].map(([id, r]) => ({ ...r, id })))
  const byId = new Map(annotations.map((a) => [a.id, a]))
  // Number in reading order; notes whose passage can no longer be found go last, unnumbered in the text.
  const inText = segments.flatMap((s) => (s.id != null ? [s.id] : []))
  const order = [...inText, ...annotations.map((a) => a.id).filter((id) => !inText.includes(id))]
  const number = new Map(order.map((id, i) => [id, i + 1]))
  const loose = new Set([...unplaced, ...annotations.filter((a) => !ranges.has(a.id)).map((a) => a.id)])

  // A passage cut by a page break keeps its anchor on its first part and its number on its last.
  const piece = (p: Piece, key: string, i: number) => {
    if (p.id == null) return <span key={key}>{seekable ? withTimes(p.text, i) : p.text}</span>
    const n = number.get(p.id)!
    return (
      <mark key={key} id={p.first ? `annotation-ref-${n}` : undefined} className="annotation-mark">
        {p.text}
        {p.last && (
          <sup data-skip="">
            <a href={`#annotation-${n}`} aria-label={`Annotation ${n}`}>
              {n}
            </a>
          </sup>
        )}
      </mark>
    )
  }
  const pages = pageFigures && pageFigures.length > 1 ? splitPages(text) : null
  const byPage = pages && pages.length === pageFigures!.length ? piecesByPage(segments, pages) : null

  return (
    <>
      {byPage ? (
        <div className="paged" lang={lang} id={id} data-view="pages">
          {byPage.map((pieces, k) => (
            <div className="paged-row" key={k}>
              <div className="paged-scan" data-skip="">
                {pageFigures![k]}
              </div>
              <div className="transcript-body paged-text">{pieces.map((p, i) => piece(p, `${k}-${i}`, i))}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="transcript-body" lang={lang} id={id}>
          {segments.map((s, i) => piece({ ...s, first: true, last: true }, String(i), i))}
        </div>
      )}
      {order.length > 0 && (
        <section className="annotations" aria-labelledby="annotations-heading">
          <h3 id="annotations-heading">Annotations</h3>
          <p className="transcript-note">Notes by project staff and visitors, checked by an editor before they appear.</p>
          <ol>
            {order.map((id) => {
              const a = byId.get(id)!
              const n = number.get(id)!
              return (
                <li key={id} id={`annotation-${n}`}>
                  <p className="annotation-quote">
                    &ldquo;<span lang={lang}>{a.quote}</span>&rdquo;{' '}
                    <span className="annotation-category">{CATEGORY[a.category] ?? a.category}</span>
                  </p>
                  <p className="annotation-body">{a.body}</p>
                  {a.source === 'public' && <p className="annotation-credit">Suggested by a visitor</p>}
                  {!loose.has(id) && (
                    <a href={`#annotation-ref-${n}`} className="annotation-back">
                      Back to the passage<span className="visually-hidden"> for annotation {n}</span>
                    </a>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </>
  )
}
