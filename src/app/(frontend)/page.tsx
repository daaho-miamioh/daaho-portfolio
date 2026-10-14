import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'

import { EventList } from '@/components/EventList'
import { ItemGrid } from '@/components/ItemCard'
import { Paragraphs } from '@/components/Paragraphs'
import { Slideshow } from '@/components/Slideshow'
import { decadeOptions } from '@/lib/itemsQuery'
import { asMedia, src, srcSet } from '@/lib/media'
import { loadProjectEvents } from '@/lib/projectEvents'
import { getViewer } from '@/lib/viewer'
import type { Item } from '@/payload-types'

export default async function HomePage() {
  const viewer = await getViewer()
  const { payload, draft, access } = viewer
  const home = await payload.findGlobal({ slug: 'home', depth: 2, draft, ...access })

  const featured = (home.featured ?? []).filter((i): i is Item => typeof i === 'object' && !!i)
  const items = featured.length
    ? featured
    : (await payload.find({ collection: 'items', sort: 'dateSort', limit: 6, depth: 1, draft, ...access })).docs

  // Count people and places through the items the visitor can see, so the numbers never advertise
  // entries whose documents are not public.
  const visible = await payload.find({ collection: 'items', limit: 0, pagination: false, depth: 1, draft, ...access })
  const peopleSeen = new Set<number>()
  const placesSeen = new Set<number>()
  for (const item of visible.docs) {
    for (const row of item.people ?? []) {
      if (typeof row.person === 'object' && row.person?.kind === 'person') peopleSeen.add(row.person.id)
    }
    for (const place of item.places ?? []) placesSeen.add(typeof place === 'object' ? place.id : place)
  }
  const decades = decadeOptions(visible.docs.map((d) => d.dateSort)).filter((d) => d.value !== 'undated')
  const itemCount = { totalDocs: visible.docs.length }
  const peopleCount = { totalDocs: peopleSeen.size }
  const placeCount = { totalDocs: placesSeen.size }

  const events = await loadProjectEvents(payload, viewer)
  const recentPast = events.past.slice(0, events.upcoming.length ? 2 : 3)
  const slides = (home.slides ?? []).flatMap((s) => {
    const m = asMedia(s.image)
    return m ? [{ src: src(m, 'reading'), srcSet: srcSet(m, ['card', 'reading']), alt: m.alt, caption: s.caption, width: m.width, height: m.height }] : []
  })
  const sponsors = (home.sponsors ?? []).map((s) => ({ ...s, logo: asMedia(s.logo) }))

  return (
    <>
      <section className="hero">
        <h1>{home.heading}</h1>
        {home.intro ? (
          <div className="prose lede">
            <RichText data={home.intro} />
          </div>
        ) : (
          <p className="lede">
            Letters, memoranda and photographs from the collections of Miami University, recording Asian
            American lives, students and communities in Ohio across the twentieth century.
          </p>
        )}
        <dl className="stats">
          <div>
            <dt>Items</dt>
            <dd>{itemCount.totalDocs}</dd>
          </div>
          <div>
            <dt>People</dt>
            <dd>{peopleCount.totalDocs}</dd>
          </div>
          <div>
            <dt>Places</dt>
            <dd>{placeCount.totalDocs}</dd>
          </div>
        </dl>
        <p className="hero-actions">
          <Link href="/items" className="button">
            Browse the collection
          </Link>
          <Link href="/timeline" className="button-secondary">
            See the timeline
          </Link>
        </p>
        {decades.length > 0 && (
          <nav aria-label="Browse by decade">
            <p className="decade-label">Browse by decade</p>
            <ul className="chips" role="list">
              {decades.map((d) => (
                <li key={d.value}>
                  <Link href={`/items?decade=${d.value}`}>
                    {d.label} <span className="count">{d.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>

      {slides.length > 0 && <Slideshow slides={slides} />}

      {home.mission && (
        <section id="mission-statement" aria-labelledby="mission-heading" className="home-mission">
          <h2 id="mission-heading">Mission statement</h2>
          <Paragraphs text={home.mission} className="prose" />
        </section>
      )}

      {(home.goals ?? []).length > 0 && (
        <section id="project-goals" aria-labelledby="goals-heading">
          <h2 id="goals-heading">Project goals</h2>
          <Paragraphs text={home.goalsIntro} className="prose" />
          <ul className="goals" role="list">
            {(home.goals ?? []).map((g) => (
              <li key={g.id ?? g.title}>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading">{featured.length ? 'Featured items' : 'From the collection'}</h2>
        <ItemGrid items={items} />
      </section>

      {(events.upcoming.length > 0 || recentPast.length > 0) && (
        <section id="events" aria-labelledby="events-heading">
          <h2 id="events-heading">Events</h2>
          {events.upcoming.length > 0 && (
            <>
              <h3>Upcoming</h3>
              <EventList events={events.upcoming} headingLevel={3} />
            </>
          )}
          {recentPast.length > 0 && (
            <>
              <h3>Recent</h3>
              <EventList events={recentPast} headingLevel={3} />
            </>
          )}
          <p>
            <Link href="/events">All events</Link>
          </p>
        </section>
      )}

      <section id="about-us" aria-labelledby="about-heading">
        <h2 id="about-heading">About us</h2>
        <p>
          DAAHO brings together scholars, librarians, archivists and community partners across Ohio and beyond.{' '}
          <Link href="/about#team">Meet our team</Link>.
        </p>
      </section>

      {sponsors.length > 0 && (
        <section aria-labelledby="sponsors-heading" className="sponsors">
          <h2 id="sponsors-heading">Sponsored by</h2>
          <ul role="list">
            {sponsors.map((s) => {
              const content = s.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src(s.logo, 'card')} alt={s.name} loading="lazy" />
              ) : (
                s.name
              )
              return <li key={s.id ?? s.name}>{s.url ? <a href={s.url}>{content}</a> : content}</li>
            })}
          </ul>
        </section>
      )}
    </>
  )
}
