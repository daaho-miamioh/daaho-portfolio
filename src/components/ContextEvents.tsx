import Link from 'next/link'

import { displayDate } from '@/lib/dates'
import type { Event } from '@/payload-types'

/** "China", "China and Japan", "China, Japan and Korea" */
function listOf(xs: string[]): string {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

export function eventDate(e: Pick<Event, 'startDate' | 'endDate'>): string {
  return e.endDate ? `${displayDate(e.startDate)} – ${displayDate(e.endDate)}` : displayDate(e.startDate)
}

/** One event: English name, names in other languages (each tagged for screen readers), date, summary. */
export function EventEntry({ event, staff, showSources = false }: { event: Event; staff: boolean; showSources?: boolean }) {
  return (
    <li className="event" id={`event-${event.slug}`}>
      <p className="event-title">
        <strong>{event.title}</strong>
        {(event.names ?? []).map((n) => (
          <span key={n.id ?? n.name} className="event-name" lang={n.language}>
            {n.name}
          </span>
        ))}
      </p>
      <p className="event-date">{eventDate(event)}</p>
      <p className="event-summary">{event.summary}</p>
      {showSources && (event.sources ?? []).length > 0 && (
        <p className="event-sources">
          Source{(event.sources ?? []).length > 1 ? 's' : ''}:{' '}
          {(event.sources ?? []).map((s, i) => (
            <span key={s.id ?? i}>
              {i > 0 && '; '}
              {s.url ? <a href={s.url} rel="noopener noreferrer">{s.citation}</a> : s.citation}
            </span>
          ))}
        </p>
      )}
      {staff && event.review?.status !== 'reviewed' && <p className="badge badge-draft">AI-drafted, not reviewed — not public</p>}
      {staff && event._status !== 'published' && event.review?.status === 'reviewed' && <p className="badge badge-draft">Reviewed, not yet published</p>}
    </li>
  )
}

export function ContextEvents({ events, regions, year, staff }: { events: Event[]; regions: string[]; year: number | null; staff: boolean }) {
  if (!events.length) return null
  return (
    <aside className="context" aria-labelledby="context-heading">
      <h2 id="context-heading">Historical context</h2>
      <p className="context-note">
        Events of the time{regions.length ? ` in the history of ${listOf(regions)}` : ''}, added by project staff. This document does not
        necessarily refer to them.
      </p>
      <ul role="list">
        {events.map((e) => (
          <EventEntry key={e.id} event={e} staff={staff} />
        ))}
      </ul>
      {year && <Link href={`/timeline#decade-${Math.floor(year / 10) * 10}`}>See the timeline</Link>}
    </aside>
  )
}
