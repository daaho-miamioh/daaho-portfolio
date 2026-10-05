import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'

import { ItemGrid } from '@/components/ItemCard'
import { getViewer } from '@/lib/viewer'
import type { Item } from '@/payload-types'

export default async function HomePage() {
  const { payload, draft, access } = await getViewer()
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
  const itemCount = { totalDocs: visible.docs.length }
  const peopleCount = { totalDocs: peopleSeen.size }
  const placeCount = { totalDocs: placesSeen.size }

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
        <p>
          <Link href="/items" className="button">
            Browse the collection
          </Link>
        </p>
      </section>

      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading">{featured.length ? 'Featured items' : 'From the collection'}</h2>
        <ItemGrid items={items} />
      </section>
    </>
  )
}
