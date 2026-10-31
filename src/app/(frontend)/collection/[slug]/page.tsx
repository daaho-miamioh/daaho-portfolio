import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ItemGrid } from '@/components/ItemCard'
import { SetArt, SetStats } from '@/components/SetCard'
import { Pagination } from '@/components/Pagination'
import { StoryGrid } from '@/components/StoryCard'
import { dateField, decadeOptions } from '@/lib/itemsQuery'
import { loadSets } from '@/lib/sets'
import { getViewer } from '@/lib/viewer'
import type { Item, ItemSet, Story } from '@/payload-types'

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

const PER_PAGE = 24

async function load(slug: string) {
  const { payload, draft, access } = await getViewer()
  const res = await payload.find({ collection: 'sets', where: { slug: { equals: slug } }, limit: 1, depth: 0, draft, ...access })
  return res.docs[0] as ItemSet | undefined
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const set = await load((await params).slug)
  return set ? { title: set.title, description: set.summary ?? undefined } : {}
}

export default async function SetPage({ params, searchParams }: Params) {
  const { slug } = await params
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const viewer = await getViewer()
  const { payload, user, draft, access } = viewer
  const publicView = !user
  // The public is not shown a collection with nothing in it they may see.
  const summary = (await loadSets(viewer)).find((s) => s.set.slug === slug)
  if (!summary) notFound()
  const { set } = summary

  const inSet = { set: { equals: set.id } }
  const visible = (
    await payload.find({
      collection: 'items',
      where: inSet,
      pagination: false,
      depth: 0,
      draft,
      select: { dateSort: true, publicDateSort: true, review: true },
      ...access,
    })
  ).docs as Pick<Item, 'id' | 'dateSort' | 'publicDateSort'>[]
  const decades = decadeOptions(visible.map((v) => (publicView ? v.publicDateSort : v.dateSort)))
  const items = await payload.find({ collection: 'items', where: inSet, sort: dateField(publicView), limit: PER_PAGE, page, depth: 1, draft, ...access })
  const stories = visible.length
    ? ((await payload.find({ collection: 'stories', where: { documents: { in: visible.map((v) => v.id) } }, pagination: false, depth: 1, draft, sort: 'title', ...access }))
        .docs as Story[])
    : []

  return (
    <article className={`set-page set-${set.color ?? 'slate'}`}>
      {set._status !== 'published' && (
        <p className="notice notice-draft" role="status">
          <strong>Draft — not public.</strong> Only signed-in project staff can see this page.
        </p>
      )}
      <p className="breadcrumb">
        <Link href="/collection#collections">Collections</Link>
      </p>

      <header className="set-hero">
        <div className="set-hero-text">
          {summary.kind && <p className="set-kind">{summary.kind}</p>}
          <h1>{set.title}</h1>
          {set.summary && <p className="lede">{set.summary}</p>}
          <SetStats summary={summary} />
          {set.holder && <p className="set-hero-holder">Held by {set.holder}</p>}
          <p className="hero-actions">
            <a href="#items" className="button">
              See the {summary.noun} <span aria-hidden="true">↓</span>
            </a>
            {set.url && (
              <a href={set.url} className="button-secondary">
                The original collection
                <span className="visually-hidden"> at {set.holder || new URL(set.url).hostname} (another website)</span> <span aria-hidden="true">↗</span>
              </a>
            )}
          </p>
        </div>
        <SetArt summary={summary} className="set-hero-art" />
      </header>

      {(set.intro || set.rights) && (
        <section className="set-intro prose" aria-label="About this collection">
          {set.intro && <RichText data={set.intro} />}
          {set.rights && <p className="set-rights">{set.rights}</p>}
        </section>
      )}

      {stories.length > 0 && (
        <section className="section" aria-labelledby="stories-heading">
          <div className="section-head">
            <div>
              <p className="eyebrow">Stories</p>
              <h2 id="stories-heading">Lives in this collection</h2>
            </div>
          </div>
          <StoryGrid stories={stories} />
        </section>
      )}

      <section id="items" className="section" aria-labelledby="items-heading">
        <div className="section-head">
          <div>
            <p className="eyebrow">In this collection</p>
            <h2 id="items-heading">Items, earliest first</h2>
          </div>
          {/* Searches the items page, kept to this collection, where the other filters are. */}
          <form className="collection-search set-search" method="get" action="/items" role="search" aria-label="Search this collection">
            <input type="hidden" name="set" value={set.slug ?? ''} />
            <label htmlFor="set-q">Search this collection</label>
            <div>
              <input id="set-q" name="q" type="search" />
              <button type="submit" className="button">
                Search
              </button>
            </div>
          </form>
        </div>
        {decades.length > 1 && (
          <ul className="chips set-decades" role="list" aria-label="By decade">
            {decades.map((d) => (
              <li key={d.value}>
                <Link href={`/items?set=${set.slug}&decade=${d.value}`}>
                  {d.label} <span className="count">{d.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <ItemGrid items={items.docs as Item[]} showSet={false} />
        <Pagination page={items.page ?? 1} totalPages={items.totalPages} href={(p) => `/collection/${set.slug}${p > 1 ? `?page=${p}` : ''}#items`} />
      </section>
    </article>
  )
}
