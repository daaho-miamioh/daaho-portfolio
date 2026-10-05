import type { Metadata } from 'next'
import Link from 'next/link'

import { ItemGrid } from '@/components/ItemCard'
import { Pagination } from '@/components/Pagination'
import { buildItemsWhere, decadeOptions, filterHref, readFilters, type ResolvedIds } from '@/lib/itemsQuery'
import { getViewer } from '@/lib/viewer'
import type { Item } from '@/payload-types'

export const metadata: Metadata = { title: 'Items' }

const PER_PAGE = 24
type TermKind = 'places' | 'subjects' | 'genres'
const FILTER_OF: Record<TermKind, 'place' | 'subject' | 'genre'> = { places: 'place', subjects: 'subject', genres: 'genre' }

export default async function ItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const filters = readFilters(params)
  const page = Math.max(1, Number(params.page) || 1)
  const { payload, draft, access } = await getViewer()

  // Menu options come from the items this visitor can see, with counts, so no option leads nowhere.
  const visible = (
    await payload.find({
      collection: 'items',
      pagination: false,
      depth: 0,
      draft,
      select: { places: true, subjects: true, genres: true, dateSort: true },
      ...access,
    })
  ).docs as Pick<Item, 'id' | 'places' | 'subjects' | 'genres' | 'dateSort'>[]

  const options = {} as Record<TermKind, { slug: string; name: string; count: number }[]>
  const resolved: ResolvedIds = {}
  for (const kind of ['places', 'subjects', 'genres'] as const) {
    const counts = new Map<number, number>()
    for (const it of visible) for (const t of it[kind] ?? []) {
      const id = typeof t === 'object' ? t.id : t
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    const terms = counts.size
      ? (await payload.find({ collection: kind, where: { id: { in: [...counts.keys()] } }, pagination: false, depth: 0, ...access })).docs
      : []
    options[kind] = terms
      .map((t) => ({ slug: t.slug ?? '', name: t.name, count: counts.get(t.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const wanted = filters[FILTER_OF[kind]]
    const match = terms.find((t) => t.slug === wanted)
    if (match) resolved[FILTER_OF[kind]] = match.id
  }
  const decades = decadeOptions(visible.map((v) => v.dateSort))

  const res = await payload.find({
    collection: 'items',
    where: buildItemsWhere(filters, resolved),
    sort: 'dateSort',
    limit: PER_PAGE,
    page,
    depth: 1,
    draft,
    ...access,
  })
  const active = Object.values(filters).some(Boolean)

  return (
    <>
      <h1>Items</h1>
      <form className="filters" method="get" action="/items" role="search" aria-label="Search and filter items">
        <div className="filter-search">
          <label htmlFor="q">Search titles, descriptions and transcripts</label>
          <input id="q" name="q" type="search" defaultValue={filters.q ?? ''} />
        </div>
        <Select id="decade" label="Decade" value={filters.decade} options={decades.map((d) => ({ value: d.value, label: `${d.label} (${d.count})` }))} />
        <Select id="place" label="Place" value={filters.place} options={options.places.map((o) => ({ value: o.slug, label: `${o.name} (${o.count})` }))} />
        <Select id="subject" label="Subject" value={filters.subject} options={options.subjects.map((o) => ({ value: o.slug, label: `${o.name} (${o.count})` }))} />
        <Select id="genre" label="Genre" value={filters.genre} options={options.genres.map((o) => ({ value: o.slug, label: `${o.name} (${o.count})` }))} />
        <div className="filter-actions">
          <button type="submit" className="button">Apply</button>
          {active && <Link href="/items">Clear all</Link>}
        </div>
      </form>

      <p className="lede" role="status">
        {active ? `${res.totalDocs} of ${visible.length} items match.` : `${res.totalDocs} items, earliest first.`}
      </p>
      <ItemGrid items={res.docs as Item[]} />
      <Pagination page={res.page ?? 1} totalPages={res.totalPages} href={(p) => filterHref('/items', filters, p)} />
    </>
  )
}

function Select({ id, label, value, options }: { id: string; label: string; value?: string; options: { value: string; label: string }[] }) {
  if (!options.length) return null
  return (
    <div className="filter-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={id} defaultValue={value ?? ''}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
