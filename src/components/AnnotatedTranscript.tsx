import { ANNOTATION_CATEGORIES } from '@/collections/Annotations'
import { locate, segment } from '@/lib/anchors'
import type { Annotation } from '@/payload-types'

const CATEGORY = Object.fromEntries(ANNOTATION_CATEGORIES.map((c) => [c.value, c.label]))

/**
 * A transcript with its approved annotations: each annotated passage is highlighted and numbered,
 * and the notes follow in an ordered list, linked both ways. Pass approved annotations only.
 */
export function AnnotatedTranscript({ text, annotations, lang }: { text: string; annotations: Annotation[]; lang?: string }) {
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

  return (
    <>
      <div className="transcript-body" lang={lang}>
        {segments.map((s, i) => {
          if (s.id == null) return <span key={i}>{s.text}</span>
          const n = number.get(s.id)!
          return (
            <mark key={i} id={`annotation-ref-${n}`} className="annotation-mark">
              {s.text}
              <sup>
                <a href={`#annotation-${n}`} aria-label={`Annotation ${n}`}>
                  {n}
                </a>
              </sup>
            </mark>
          )
        })}
      </div>
      {order.length > 0 && (
        <section className="annotations" aria-labelledby="annotations-heading">
          <h3 id="annotations-heading">Annotations</h3>
          <p className="transcript-note">Notes added by project staff and reviewed before publication.</p>
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
