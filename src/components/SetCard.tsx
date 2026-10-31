import Link from 'next/link'

import { src } from '@/lib/media'
import type { SetSummary } from '@/lib/sets'

/** Where each scan lies in the fan, by how many there are: the first in front. */
const FAN: Record<number, string[]> = { 1: ['fan-solo'], 2: ['fan-front', 'fan-back'], 3: ['fan-front', 'fan-left', 'fan-right'] }

/** A small seeded random number generator, so a collection's wave is the same on every visit. */
function seeded(text: string) {
  let a = [...text].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 7)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A sound wave, for a collection of recordings: they have no scans to show. */
function Waveform({ seed }: { seed: string }) {
  const next = seeded(seed)
  const bars = Array.from({ length: 48 }, (_, i) => 0.12 + 0.88 * Math.sin((Math.PI * (i + 0.5)) / 48) ** 0.7 * (0.3 + 0.7 * next()))
  return (
    <svg className="set-wave" viewBox="0 0 96 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {bars.map((b, i) => (
        <rect key={i} x={i * 2 + 0.4} y={20 - b * 18} width="1.2" height={b * 36} rx="0.6" />
      ))}
    </svg>
  )
}

/** The collection's picture: a fan of scans from across its dates, a sound wave, or its kind in words. */
export function SetArt({ summary: s, className = '' }: { summary: SetSummary; className?: string }) {
  return (
    <div className={`set-art ${className}`} aria-hidden="true">
      {s.scans.length ? (
        s.scans.map((m, i) => (
          // Decorative: the title names the collection.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.id} className={FAN[s.scans.length][i]} src={src(m, 'card')} alt="" loading="lazy" />
        ))
      ) : s.recordings ? (
        <Waveform seed={s.set.slug ?? s.set.title} />
      ) : (
        <span className="set-art-word">{s.kind}</span>
      )}
    </div>
  )
}

/** Its count and dates, large, so collections can be compared at a glance. */
export function SetStats({ summary: s }: { summary: SetSummary }) {
  return (
    <dl className="set-stats">
      <div>
        <dt>{s.noun}</dt>
        <dd>{s.count}</dd>
      </div>
      {s.span && (
        <div>
          <dt>{s.span.includes('–') ? 'Dates' : 'Date'}</dt>
          <dd>{s.span}</dd>
        </div>
      )}
    </dl>
  )
}

export function SetCard({ summary: s }: { summary: SetSummary }) {
  return (
    <li className={`set-card set-${s.set.color ?? 'slate'}`}>
      <Link href={`/collection/${s.set.slug}`} className="set-card-link">
        <SetArt summary={s} />
        <div className="set-card-body">
          {s.kind && <p className="set-kind">{s.kind}</p>}
          <h3 className="set-card-title">{s.set.title}</h3>
          {s.set.summary && <p className="set-card-summary">{s.set.summary}</p>}
          <SetStats summary={s} />
          {s.set.holder && <p className="set-card-holder">{s.set.holder}</p>}
          {s.set._status !== 'published' && <p className="badge badge-draft">Draft</p>}
        </div>
      </Link>
    </li>
  )
}

export function SetGrid({ sets }: { sets: SetSummary[] }) {
  return (
    <ul className="set-grid" role="list">
      {sets.map((s) => (
        <SetCard key={s.set.id} summary={s} />
      ))}
    </ul>
  )
}
