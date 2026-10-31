import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'

import { EventList } from '@/components/EventList'
import { ItemGrid } from '@/components/ItemCard'
import { SetGrid } from '@/components/SetCard'
import { Slideshow } from '@/components/Slideshow'
import { Sponsors } from '@/components/Sponsors'
import { StoryGrid } from '@/components/StoryCard'
import { dateField, decadeOptions } from '@/lib/itemsQuery'
import { asMedia, src, srcSet } from '@/lib/media'
import { loadProjectEvents } from '@/lib/projectEvents'
import { loadSets } from '@/lib/sets'
import { getViewer } from '@/lib/viewer'
import type { Item, Story } from '@/payload-types'

export default async function HomePage() {
  const viewer = await getViewer()
  const { payload, draft, access } = viewer
  const publicView = !viewer.user
  const home = await payload.findGlobal({ slug: 'home', depth: 2, draft, ...access })

  const featured = (home.featured ?? []).filter((i): i is Item => typeof i === 'object' && !!i)
  const items = featured.length
    ? featured
    : (await payload.find({ collection: 'items', sort: dateField(publicView), limit: 6, depth: 1, draft, ...access })).docs

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
  const decades = decadeOptions(visible.docs.map((d) => (publicView ? d.publicDateSort : d.dateSort))).filter((d) => d.value !== 'undated')
  const itemCount = { totalDocs: visible.docs.length }
  const peopleCount = { totalDocs: peopleSeen.size }
  const placeCount = { totalDocs: placesSeen.size }

  const sets = await loadSets(viewer)
  const events = await loadProjectEvents(payload, viewer)
  const stories = (await payload.find({ collection: 'stories', limit: 3, depth: 1, draft, sort: '-publishedAt', ...access })).docs as Story[]
  const recentPast = events.past.slice(0, events.upcoming.length ? 2 : 3)
  const slides = (home.slides ?? []).flatMap((s) => {
    const m = asMedia(s.image)
    return m ? [{ src: src(m, 'reading'), srcSet: srcSet(m, ['card', 'reading']), alt: m.alt, caption: s.caption, width: m.width, height: m.height }] : []
  })
  // Six document scans for the hero: featured items first, then the rest of what this visitor can see.
  const seen = new Set<number>()
  const mosaic = [...items, ...visible.docs]
    .filter((i) => !seen.has(i.id) && seen.add(i.id))
    .map((i) => asMedia(i.pages?.[0]?.image))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .slice(0, 6)

  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow">Miami University Libraries · Digital collection</p>
          <h1 id="hero-heading" className="display">
            {home.heading}
          </h1>
          {home.intro ? (
            <div className="lede">
              <RichText data={home.intro} />
            </div>
          ) : (
            <p className="lede">
              Letters, records and recordings on Asian American lives, students and communities in Ohio, from the
              archives of Miami University and from partner collections.
            </p>
          )}
          <p className="hero-actions">
            <Link href="/items" className="button">
              Browse the collection <span aria-hidden="true">→</span>
            </Link>
            <Link href="/timeline" className="button-secondary">
              See the timeline
            </Link>
          </p>
          <dl className="stats">
            <div>
              <dt>Items</dt>
              <dd>{itemCount.totalDocs}</dd>
            </div>
            {/* The public sees an item's people and places only once its links are checked, so these can be zero. */}
            {peopleCount.totalDocs > 0 && (
              <div>
                <dt>People</dt>
                <dd>{peopleCount.totalDocs}</dd>
              </div>
            )}
            {placeCount.totalDocs > 0 && (
              <div>
                <dt>Places</dt>
                <dd>{placeCount.totalDocs}</dd>
              </div>
            )}
          </dl>
        </div>
        {mosaic.length >= 3 && (
          <div className="hero-mosaic" aria-hidden="true">
            {mosaic.map((m) => (
              // Decorative: a glimpse of the documents; each is reachable, with its description, from the collection.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={src(m, 'card')} alt="" width={400} height={500} />
            ))}
          </div>
        )}
      </section>

      {decades.length > 0 && (
        <nav aria-label="Browse by decade" className="decades">
          <p className="eyebrow">Browse by decade</p>
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

      {sets.length > 0 && (
        <section aria-labelledby="collections-heading" className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 id="collections-heading">The collections</h2>
            </div>
            <Link href="/collection" className="section-link">
              Search and browse it all <span aria-hidden="true">→</span>
            </Link>
          </div>
          <SetGrid sets={sets} />
        </section>
      )}

      {slides.length > 0 && <Slideshow slides={slides} />}

      <section aria-labelledby="featured-heading" className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">The collection</p>
            <h2 id="featured-heading">{featured.length ? 'Featured items' : 'From the collection'}</h2>
          </div>
          <Link href="/items" className="section-link">
            All {itemCount.totalDocs} items <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ItemGrid items={items} />
      </section>

      {stories.length > 0 && (
        <section aria-labelledby="stories-heading" className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Stories</p>
              <h2 id="stories-heading">Lives in the collection</h2>
            </div>
            <Link href="/stories" className="section-link">
              All stories <span aria-hidden="true">→</span>
            </Link>
          </div>
          <StoryGrid stories={stories} />
        </section>
      )}

      {(events.upcoming.length > 0 || recentPast.length > 0) && (
        <section id="events" aria-labelledby="events-heading" className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Events</p>
              <h2 id="events-heading">{events.upcoming.length ? 'Upcoming and recent' : 'Recent events'}</h2>
            </div>
            <Link href="/events" className="section-link">
              All events <span aria-hidden="true">→</span>
            </Link>
          </div>
          <EventList events={[...events.upcoming, ...recentPast]} headingLevel={3} />
        </section>
      )}

      <section id="about-us" aria-labelledby="about-heading" className="section about-teaser">
        <div>
          <p className="eyebrow">About us</p>
          <h2 id="about-heading">Making visible what was previously invisible</h2>
        </div>
        <div>
          <p className="lede">
            DAAHO brings together scholars, librarians, archivists and community partners across Ohio and beyond to
            collect, preserve and share Asian American histories.
          </p>
          <p className="hero-actions">
            <Link href="/about" className="button-secondary">
              Our mission and goals <span aria-hidden="true">→</span>
            </Link>
            <Link href="/about/team" className="section-link">
              Meet our team <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <Sponsors sponsors={home.sponsors} />
    </>
  )
}
