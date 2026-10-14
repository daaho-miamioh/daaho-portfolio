import Link from 'next/link'

import { EVENT_KINDS } from '@/collections/ProjectEvents'
import { formatEventDates } from '@/lib/eventDates'
import type { ProjectEvent } from '@/payload-types'

const KIND = Object.fromEntries(EVENT_KINDS.map((k) => [k.value, k.label]))

export function EventList({ events, headingLevel = 3 }: { events: ProjectEvent[]; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as const
  return (
    <ul className="event-list" role="list">
      {events.map((e) => (
        <li key={e.id} className="event-row">
          <p className="event-when">
            <time dateTime={e.start}>{formatEventDates(e.start, e.end)}</time>
            {e.kind && e.kind !== 'other' && <span className="event-kind">{KIND[e.kind]}</span>}
            {e._status !== 'published' && <span className="badge badge-draft">Draft</span>}
          </p>
          <H className="event-title">
            <Link href={`/events/${e.slug}`}>{e.title}</Link>
          </H>
          {e.location && <p className="card-meta">{e.location}</p>}
          <p className="event-summary">{e.summary}</p>
        </li>
      ))}
    </ul>
  )
}
