import type { Metadata } from 'next'

import { EventList } from '@/components/EventList'
import { Paragraphs } from '@/components/Paragraphs'
import { loadProjectEvents } from '@/lib/projectEvents'
import { getViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Events', description: 'Exhibits, talks and conferences from the DAAHO project.' }

export default async function EventsPage() {
  const viewer = await getViewer()
  const [home, { upcoming, past }] = await Promise.all([
    viewer.payload.findGlobal({ slug: 'home', depth: 0, ...viewer.access }),
    loadProjectEvents(viewer.payload, viewer),
  ])
  return (
    <>
      <h1>Events</h1>
      <Paragraphs text={home.eventsIntro} className="prose lede" />
      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">Upcoming events</h2>
        {upcoming.length ? <EventList events={upcoming} /> : <p>No upcoming events are scheduled. Check back soon.</p>}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading">Past events</h2>
          <EventList events={past} />
        </section>
      )}
    </>
  )
}
