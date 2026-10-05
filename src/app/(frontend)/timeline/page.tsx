import type { Metadata } from 'next'
import Link from 'next/link'

import { EventEntry } from '@/components/ContextEvents'
import { yearOf } from '@/lib/context'
import { getViewer } from '@/lib/viewer'
import type { Event } from '@/payload-types'

export const metadata: Metadata = { title: 'Timeline' }

export default async function TimelinePage() {
  const { payload, user, draft, access } = await getViewer()
  const events = (await payload.find({ collection: 'events', pagination: false, depth: 0, draft, sort: 'startDate', ...access })).docs as Event[]
  const items = (await payload.find({ collection: 'items', pagination: false, depth: 0, draft, select: { dateSort: true }, ...access })).docs

  const itemsPerDecade = new Map<number, number>()
  for (const it of items) {
    const y = yearOf(it.dateSort)
    if (y !== null) itemsPerDecade.set(Math.floor(y / 10) * 10, (itemsPerDecade.get(Math.floor(y / 10) * 10) ?? 0) + 1)
  }
  const eventsPerDecade = new Map<number, Event[]>()
  for (const e of events) {
    if (typeof e.startYear !== 'number') continue
    const d = Math.floor(e.startYear / 10) * 10
    eventsPerDecade.set(d, [...(eventsPerDecade.get(d) ?? []), e])
  }
  const decades = [...new Set([...itemsPerDecade.keys(), ...eventsPerDecade.keys()])].sort((a, b) => a - b)

  return (
    <>
      <h1>Timeline</h1>
      <p className="lede">
        The collection&rsquo;s documents by decade, alongside events in East Asian and Asian American history. Event
        summaries are drafted with AI and published only after project staff have checked them against the sources
        listed.
      </p>
      {decades.length === 0 && <p className="empty">Nothing to show yet.</p>}
      <ol className="timeline" role="list">
        {decades.map((d) => {
          const count = itemsPerDecade.get(d) ?? 0
          return (
            <li key={d} id={`decade-${d}`} className="decade">
              <h2>{d}s</h2>
              {count > 0 && (
                <p className="decade-items">
                  <Link href={`/items?decade=${d}s`}>
                    {count} {count === 1 ? 'item' : 'items'} from the {d}s →
                  </Link>
                </p>
              )}
              {(eventsPerDecade.get(d) ?? []).length > 0 && (
                <ul className="events" role="list">
                  {eventsPerDecade.get(d)!.map((e) => (
                    <EventEntry key={e.id} event={e} staff={!!user} showSources />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}
