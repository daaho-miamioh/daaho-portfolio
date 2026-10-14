import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EVENT_KINDS } from '@/collections/ProjectEvents'
import { Paragraphs } from '@/components/Paragraphs'
import { formatEventDates, isUpcoming } from '@/lib/eventDates'
import { asMedia, src, srcSet } from '@/lib/media'
import { getViewer } from '@/lib/viewer'
import type { ProjectEvent } from '@/payload-types'

type Params = { params: Promise<{ slug: string }> }
const KIND = Object.fromEntries(EVENT_KINDS.map((k) => [k.value, k.label]))

async function load(slug: string) {
  const { payload, draft, access } = await getViewer()
  const res = await payload.find({ collection: 'project-events', where: { slug: { equals: slug } }, limit: 1, depth: 1, draft, ...access })
  return res.docs[0] as ProjectEvent | undefined
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const e = await load((await params).slug)
  return e ? { title: e.title, description: e.summary } : {}
}

export default async function EventPage({ params }: Params) {
  const e = await load((await params).slug)
  if (!e) notFound()
  const images = (e.images ?? []).map((r) => ({ media: asMedia(r.image), caption: r.caption })).filter((r) => r.media)

  return (
    <article className="event-page">
      {e._status !== 'published' && (
        <p className="notice notice-draft" role="status">
          <strong>Draft — not public.</strong> Only signed-in project staff can see this page.
        </p>
      )}
      <p className="breadcrumb">
        <Link href="/events">Events</Link>
      </p>
      <h1>{e.title}</h1>
      <dl className="event-facts">
        <dt>When</dt>
        <dd>
          <time dateTime={e.start}>{formatEventDates(e.start, e.end)}</time>
          {e.timeText && <> · {e.timeText}</>}
          {!isUpcoming(e) && <span className="event-kind">Past event</span>}
        </dd>
        {e.location && (
          <>
            <dt>Where</dt>
            <dd>{e.location}</dd>
          </>
        )}
        {e.kind && e.kind !== 'other' && (
          <>
            <dt>Type</dt>
            <dd>{KIND[e.kind]}</dd>
          </>
        )}
        {(e.sponsors ?? []).length > 0 && (
          <>
            <dt>Sponsors</dt>
            <dd>{(e.sponsors ?? []).map((s) => s.name).join(' · ')}</dd>
          </>
        )}
      </dl>
      {e.link && (
        <p>
          <a href={e.link} className="button" rel="noopener">
            Event website<span className="visually-hidden"> (opens another site)</span>
          </a>
        </p>
      )}
      <Paragraphs text={e.description || e.summary} className="prose" />
      {images.length > 0 && (
        <div className="event-images">
          {images.map(({ media, caption }) => (
            <figure key={media!.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(media!, 'card')} srcSet={srcSet(media!, ['card', 'reading'])} sizes="(min-width: 50rem) 24rem, 100vw" alt={media!.alt} loading="lazy" width={media!.width ?? undefined} height={media!.height ?? undefined} />
              {caption && <figcaption>{caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </article>
  )
}
