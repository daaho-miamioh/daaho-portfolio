import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { citations, siteBase } from '@/lib/citation'
import { displayDate } from '@/lib/dates'
import { asMedia, src, srcSet } from '@/lib/media'
import { getViewer } from '@/lib/viewer'
import type { Item, Story } from '@/payload-types'

type Params = { params: Promise<{ slug: string }> }

async function load(slug: string) {
  const { payload, draft, access } = await getViewer()
  // depth 2: the story's documents, and each document's first scan.
  const res = await payload.find({ collection: 'stories', where: { slug: { equals: slug } }, limit: 1, depth: 2, draft, ...access })
  return res.docs[0] as Story | undefined
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const s = await load((await params).slug)
  return s ? { title: s.title, description: s.dek ?? undefined } : {}
}

export default async function StoryPage({ params }: Params) {
  const { slug } = await params
  const story = await load(slug)
  if (!story) notFound()

  const portrait = asMedia(story.subject?.portrait)
  // Carver's exhibit order: the documents left to right in date order; undated ones last.
  const documents = (story.documents ?? [])
    .filter((d): d is Item => typeof d === 'object' && !!d)
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
  const url = `${siteBase()}/stories/${story.slug}`
  const cite = citations({ title: story.title, authors: story.authors ?? [], published: story.publishedAt, url })
  const tags = [...(story.decades ?? []), ...(story.themes ?? [])]

  return (
    <article className="story">
      {story._status !== 'published' && (
        <p className="notice notice-draft" role="status">
          <strong>Draft — not public.</strong> Only signed-in project staff can see this page.
        </p>
      )}
      <p className="breadcrumb">
        <Link href="/stories">Stories</Link>
      </p>

      <header className="story-hero">
        {portrait && (
          <figure className="story-portrait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(portrait, 'reading')} srcSet={srcSet(portrait, ['card', 'reading'])} sizes="(min-width: 60rem) 22rem, 100vw" alt={portrait.alt} width={portrait.width ?? undefined} height={portrait.height ?? undefined} />
            {story.subject?.portraitCaption && <figcaption>{story.subject.portraitCaption}</figcaption>}
          </figure>
        )}
        <div className="story-intro">
          <p className="eyebrow">{story.storyType === 'theme' ? 'Theme' : 'Biography'}</p>
          <h1>{story.title}</h1>
          {(story.subject?.lifeDates || story.subject?.atMiami) && (
            <p className="story-facts-line">{[story.subject?.lifeDates, story.subject?.atMiami && `Miami University: ${story.subject.atMiami}`].filter(Boolean).join(' · ')}</p>
          )}
          {story.dek && <p className="lede">{story.dek}</p>}
          {story.credit && <p className="story-credit">{story.credit}</p>}
          {tags.length > 0 && (
            <ul className="chips story-tags" role="list" aria-label="Decades and themes">
              {tags.map((t) => (
                <li key={t}>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
          {documents.length > 0 && (
            <p>
              <a href="#documents" className="button-secondary">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'} in the collection <span aria-hidden="true">↓</span>
              </a>
            </p>
          )}
        </div>
      </header>

      <div className="story-body prose">
        <RichText data={story.body} />
      </div>

      {documents.length > 0 && (
        <section id="documents" className="story-documents" aria-labelledby="documents-heading">
          <p className="eyebrow">In the collection</p>
          <h2 id="documents-heading">Documents, in date order</h2>
          <ol className="doc-timeline" role="list">
            {documents.map((d) => {
              const cover = asMedia(d.pages?.[0]?.image)
              return (
                <li key={d.id}>
                  {d.date || d.review?.titleChecked ? (
                    <p className="doc-date">{displayDate(d.date)}</p>
                  ) : (
                    <p className="doc-date is-pending">Date in review</p>
                  )}
                  <Link href={`/items/${d.slug}`} className="doc-card">
                    <span className="doc-image">
                      {/* The link names the document; the scan is decorative here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cover ? <img src={src(cover, 'card')} alt="" loading="lazy" /> : <span className="card-noimage" aria-hidden="true" />}
                    </span>
                    <span className="doc-title">{d.title}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {(story.elsewhere ?? []).length > 0 && (
        <section className="story-elsewhere" aria-labelledby="elsewhere-heading">
          <h2 id="elsewhere-heading">More documents elsewhere</h2>
          <ul role="list">
            {(story.elsewhere ?? []).map((l) => (
              <li key={l.id ?? l.url}>
                <a href={l.url} rel="noopener">
                  {l.title}
                </a>
                {l.description && <p>{l.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {story.sources && (
        <section className="story-sources" aria-labelledby="sources-heading">
          <h2 id="sources-heading">Sources</h2>
          <div className="prose">
            <RichText data={story.sources} />
          </div>
        </section>
      )}

      <section className="story-cite" aria-labelledby="cite-heading">
        <h2 id="cite-heading">Cite this story</h2>
        <dl>
          <dt>Chicago</dt>
          <dd>{cite.chicago}</dd>
          <dt>APA</dt>
          <dd>{cite.apa}</dd>
          <dt>MLA</dt>
          <dd>{cite.mla}</dd>
        </dl>
        {story.origin?.url && (
          <p className="story-origin">
            First published on{' '}
            <a href={story.origin.url} rel="noopener">
              {story.origin.site || 'another site'}
            </a>
            {story.origin.license && (
              <>
                {' '}
                and shared under{' '}
                {story.origin.licenseUrl ? (
                  <a href={story.origin.licenseUrl} rel="license noopener">
                    {story.origin.license}
                  </a>
                ) : (
                  story.origin.license
                )}
              </>
            )}
            .
          </p>
        )}
      </section>
    </article>
  )
}
