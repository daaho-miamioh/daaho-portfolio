import type { Metadata } from 'next'
import Link from 'next/link'

import { decadeOptions } from '@/lib/itemsQuery'
import { getViewer } from '@/lib/viewer'
import type { Item } from '@/payload-types'

export const metadata: Metadata = {
  title: 'Collection',
  description: 'Search and browse the letters, documents and photographs in the DAAHO collection.',
}

/** "clippings (information artifacts)" → "Clippings": the Getty term without its qualifier, as a label. */
const genreLabel = (name: string) => {
  const s = name.replace(/\s*\([^)]*\)/g, '').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const idOf = (t: number | { id: number } | null | undefined) => (typeof t === 'object' ? t?.id : t)

export default async function CollectionPage() {
  const { payload, user, draft, access } = await getViewer()
  const publicView = !user

  // Counted from the items this visitor can see, as the index pages these link to are.
  const visible = (
    await payload.find({
      collection: 'items',
      pagination: false,
      depth: 0,
      draft,
      // `review` lets the read hook tell which of these the public may see.
      select: { people: true, places: true, subjects: true, genres: true, dateSort: true, publicDateSort: true, review: true },
      ...access,
    })
  ).docs as Pick<Item, 'id' | 'people' | 'places' | 'subjects' | 'genres' | 'dateSort' | 'publicDateSort'>[]

  const distinct = (ids: (number | undefined)[]) => new Set(ids.filter((id) => typeof id === 'number')).size
  const counts = {
    items: visible.length,
    people: distinct(visible.flatMap((i) => (i.people ?? []).map((r) => idOf(r.person)))),
    places: distinct(visible.flatMap((i) => (i.places ?? []).map(idOf))),
    subjects: distinct(visible.flatMap((i) => (i.subjects ?? []).map(idOf))),
  }

  const perGenre = new Map<number, number>()
  for (const i of visible) for (const g of new Set((i.genres ?? []).map(idOf))) if (g) perGenre.set(g, (perGenre.get(g) ?? 0) + 1)
  const genres = perGenre.size
    ? (await payload.find({ collection: 'genres', where: { id: { in: [...perGenre.keys()] } }, pagination: false, depth: 0, ...access })).docs
        .map((g) => ({ slug: g.slug, name: genreLabel(g.name), count: perGenre.get(g.id) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    : []
  const decades = decadeOptions(visible.map((v) => (publicView ? v.publicDateSort : v.dateSort))).filter((d) => d.value !== 'undated')

  const browse = [
    { href: '/items', label: 'Items', count: counts.items, text: 'Every item, with search and filters by decade, place, subject and type.' },
    { href: '/people', label: 'People', count: counts.people, text: 'People and organizations named in the documents.' },
    { href: '/places', label: 'Places', count: counts.places, text: 'Where the documents were written.' },
    { href: '/subjects', label: 'Subjects', count: counts.subjects, text: 'What the documents are about.' },
    { href: '/timeline', label: 'Timeline', count: 0, text: 'The documents by decade, beside events in East Asian and Asian American history.' },
  ]

  return (
    <>
      <h1>The collection</h1>
      <p className="lede">
        Letters, memoranda and photographs from the collections of Miami University, recording Asian American lives,
        students and communities in Ohio across the twentieth century.
      </p>

      <form className="collection-search" method="get" action="/items" role="search" aria-label="Search the collection">
        <label htmlFor="q">Search {counts.items} items</label>
        <div>
          <input id="q" name="q" type="search" />
          <button type="submit" className="button">
            Search
          </button>
        </div>
      </form>

      <section aria-labelledby="browse-heading" className="hub-section">
        <h2 id="browse-heading">Browse</h2>
        <ul className="browse" role="list">
          {browse.map((b) => (
            <li key={b.href}>
              <Link href={b.href}>
                <span className="browse-label">
                  {b.label}
                  {b.count > 0 && <span className="count">{b.count}</span>}
                </span>
                <span className="browse-text">{b.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {decades.length > 0 && (
        <section aria-labelledby="decades-heading" className="hub-section">
          <h2 id="decades-heading">By decade</h2>
          <ul className="chips" role="list">
            {decades.map((d) => (
              <li key={d.value}>
                <Link href={`/items?decade=${d.value}`}>
                  {d.label} <span className="count">{d.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {genres.length > 0 && (
        <section aria-labelledby="types-heading" className="hub-section">
          <h2 id="types-heading">By type of document</h2>
          <ul className="chips" role="list">
            {genres.map((g) => (
              <li key={g.slug}>
                <Link href={`/items?genre=${g.slug}`}>
                  {g.name} <span className="count">{g.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
