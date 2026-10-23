import type { Metadata } from 'next'
import Link from 'next/link'

import { EventEntry } from '@/components/ContextEvents'
import { yearOf } from '@/lib/context'
import { dateField } from '@/lib/itemsQuery'
import { asMedia, src } from '@/lib/media'
import { getViewer } from '@/lib/viewer'
import type { Event, Item } from '@/payload-types'

export const metadata: Metadata = { title: 'Timeline' }

export default async function TimelinePage() {
  const { payload, user, draft, access } = await getViewer()
  const events = (await payload.find({ collection: 'events', pagination: false, depth: 0, draft, sort: 'startDate', ...access })).docs as Event[]
  const items = (
    await payload.find({
      collection: 'items',
      pagination: false,
      depth: 1,
      draft,
      sort: dateField(!user),
      select: { dateSort: true, publicDateSort: true, title: true, itemId: true, archival: true, review: true, slug: true, pages: true },
      ...access,
    })
  ).docs as Pick<Item, 'id' | 'dateSort' | 'publicDateSort' | 'title' | 'slug' | 'pages'>[]

  const itemsPerDecade = new Map<number, number>()
  const thumbsPerDecade = new Map<number, { slug: string; title: string; src: string }[]>()
  for (const it of items) {
    const y = yearOf(user ? it.dateSort : it.publicDateSort)
    if (y === null) continue
    const d = Math.floor(y / 10) * 10
    itemsPerDecade.set(d, (itemsPerDecade.get(d) ?? 0) + 1)
    const cover = asMedia(it.pages?.[0]?.image)
    const thumbs = thumbsPerDecade.get(d) ?? []
    if (cover && it.slug && thumbs.length < 6) thumbsPerDecade.set(d, [...thumbs, { slug: it.slug, title: it.title, src: src(cover, 'thumbnail') }])
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
              {(thumbsPerDecade.get(d) ?? []).length > 0 && (
                <ul className="decade-thumbs" role="list">
                  {thumbsPerDecade.get(d)!.map((th) => (
                    <li key={th.slug}>
                      <Link href={`/items/${th.slug}`} title={th.title}>
                        {/* The link is named by the item title; the scan is decorative here. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={th.src} alt="" width={120} height={150} loading="lazy" />
                        <span className="visually-hidden">{th.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
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
