import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'

import { EventList } from '@/components/EventList'
import { ItemGrid } from '@/components/ItemCard'
import { Paragraphs } from '@/components/Paragraphs'
import { Slideshow } from '@/components/Slideshow'
import { StoryGrid } from '@/components/StoryCard'
import { dateField, decadeOptions } from '@/lib/itemsQuery'
import { asMedia, src, srcSet } from '@/lib/media'
import { loadProjectEvents } from '@/lib/projectEvents'
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

  const events = await loadProjectEvents(payload, viewer)
  const stories = (await payload.find({ collection: 'stories', limit: 3, depth: 1, draft, sort: '-publishedAt', ...access })).docs as Story[]
  const recentPast = events.past.slice(0, events.upcoming.length ? 2 : 3)
  const slides = (home.slides ?? []).flatMap((s) => {
    const m = asMedia(s.image)
    return m ? [{ src: src(m, 'reading'), srcSet: srcSet(m, ['card', 'reading']), alt: m.alt, caption: s.caption, width: m.width, height: m.height }] : []
  })
  const sponsors = (home.sponsors ?? []).map((s) => ({ ...s, logo: asMedia(s.logo) }))
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
              Letters, memoranda and photographs from the collections of Miami University, recording Asian American
              lives, students and communities in Ohio across the twentieth century.
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
            <div>
              <dt>People</dt>
              <dd>{peopleCount.totalDocs}</dd>
            </div>
            <div>
              <dt>Places</dt>
              <dd>{placeCount.totalDocs}</dd>
            </div>
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

      {slides.length > 0 && <Slideshow slides={slides} />}

      {home.mission && (
        <section id="mission-statement" aria-labelledby="mission-heading" className="band band-dark home-mission">
          <p className="eyebrow">Mission</p>
          <h2 id="mission-heading">Making visible what was previously invisible</h2>
          <Paragraphs text={home.mission} className="mission-text" />
        </section>
      )}

      {(home.goals ?? []).length > 0 && (
        <section id="project-goals" aria-labelledby="goals-heading" className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Project goals</p>
              <h2 id="goals-heading">What we are working toward</h2>
            </div>
          </div>
          <Paragraphs text={home.goalsIntro} className="lede" />
          <ol className="goals">
            {(home.goals ?? []).map((g) => (
              <li key={g.id ?? g.title}>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

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
          <h2 id="about-heading">Scholars, librarians, archivists and community partners</h2>
        </div>
        <div>
          <p className="lede">
            DAAHO brings together people across Ohio and beyond to collect, preserve and share Asian American
            histories.
          </p>
          <Link href="/about#team" className="button-secondary">
            Meet our team <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {sponsors.length > 0 && (
        <section aria-labelledby="sponsors-heading" className="sponsors">
          <p id="sponsors-heading" className="eyebrow">
            Supported by
          </p>
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
