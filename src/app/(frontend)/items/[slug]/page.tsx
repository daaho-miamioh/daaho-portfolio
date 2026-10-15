import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PERSON_ROLES } from '@/collections/Items'
import { AnnotatedTranscript } from '@/components/AnnotatedTranscript'
import { ContextEvents } from '@/components/ContextEvents'
import { ItemGrid } from '@/components/ItemCard'
import { eventsForItem, yearOf } from '@/lib/context'
import { displayDate } from '@/lib/dates'
import { langAttr } from '@/lib/lang'
import { asMedia, src, srcSet } from '@/lib/media'
import { relatedItems, toLinkable, type Kind } from '@/lib/related'
import { getViewer } from '@/lib/viewer'
import type { Annotation, Event, Genre, Item, Person, Place, Subject, User } from '@/payload-types'

type Params = { params: Promise<{ slug: string }> }

async function load(slug: string) {
  const { payload, draft, access } = await getViewer()
  const res = await payload.find({
    collection: 'items',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    draft,
    ...access,
  })
  return res.docs[0] as Item | undefined
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = await load((await params).slug)
  return item ? { title: item.title, description: item.description ?? undefined } : {}
}

const roleLabel = Object.fromEntries(PERSON_ROLES.map((r) => [r.value, r.label]))
const populated = <T extends { id: number }>(xs: (number | T)[] | null | undefined) =>
  (xs ?? []).filter((x): x is T => typeof x === 'object' && !!x)

/** Items sharing the most telling people, subjects and places, among those this visitor can see. */
async function loadRelated(item: Item) {
  const { payload, draft, access } = await getViewer()
  const all = await payload.find({
    collection: 'items',
    pagination: false,
    depth: 0,
    draft,
    select: { people: true, places: true, subjects: true, genres: true },
    ...access,
  })
  const ranked = relatedItems(toLinkable(item), all.docs.map((d) => toLinkable(d as Item)))
  if (!ranked.length) return []
  const docs = await payload.find({
    collection: 'items',
    where: { id: { in: ranked.map((r) => r.id) } },
    pagination: false,
    depth: 1,
    draft,
    ...access,
  })
  const byId = new Map((docs.docs as Item[]).map((d) => [d.id, d]))
  return ranked.filter((r) => byId.has(r.id)).map((r) => ({ ...r, item: byId.get(r.id)! }))
}

/** Events under way in the item's year, for the regions it concerns; editors' pins first. */
async function loadContext(item: Item) {
  const { payload, user, draft, access } = await getViewer()
  const events = (await payload.find({ collection: 'events', pagination: false, depth: 0, draft, sort: 'startYear', ...access })).docs as Event[]
  type Dated = Event & { startYear: number }
  const dated = (e: Event | undefined): e is Dated => typeof e?.startYear === 'number'
  const visible = new Map(events.map((e) => [e.id, e]))
  const pinned = (item.contextEvents ?? []).map((e) => visible.get(typeof e === 'object' ? e.id : e)).filter(dated)
  const year = yearOf(item.dateSort)
  const chosen = eventsForItem(
    { year, regions: item.regions ?? [], pinned, hideAutomatic: !!item.hideAutoContext },
    events.filter(dated),
  )
  return { events: chosen as Event[], year, staff: !!user }
}

/**
 * Approved annotations only, for everyone, so staff see the page as the public does. Staff also get a
 * count of those still awaiting review.
 */
async function loadAnnotations(item: Item) {
  const { payload, user } = await getViewer()
  const approved = (
    await payload.find({
      collection: 'annotations',
      where: { and: [{ item: { equals: item.id } }, { status: { equals: 'approved' } }] },
      pagination: false,
      depth: 0,
      overrideAccess: false,
      user,
    })
  ).docs as Annotation[]
  const pending = user
    ? (await payload.count({ collection: 'annotations', where: { and: [{ item: { equals: item.id } }, { status: { equals: 'submitted' } }] }, overrideAccess: false, user })).totalDocs
    : 0
  return { approved, pending }
}

export default async function ItemPage({ params }: Params) {
  const item = await load((await params).slug)
  if (!item) notFound()
  const related = await loadRelated(item)
  const context = await loadContext(item)
  const annotations = await loadAnnotations(item)
  const { payload, user } = await getViewer()
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 })
  const rights = item.rights || settings.defaultRights
  // Originals for staff always; for the public only once the PI allows it.
  const fullResolution = !!user || !!settings.allowFullResolution

  const pages = (item.pages ?? []).map((p) => ({ media: asMedia(p.image), label: p.label })).filter((p) => p.media)
  const people = (item.people ?? [])
    .map((row) => ({ person: typeof row.person === 'object' ? (row.person as Person) : null, role: row.role }))
    .filter((r): r is { person: Person; role: typeof r.role } => !!r.person)
  const places = populated<Place>(item.places)
  const subjects = populated<Subject>(item.subjects)
  const genres = populated<Genre>(item.genres)
  // Name each shared link, so a reader can see why an item is suggested.
  const names = new Map<string, string>()
  for (const { person } of people) names.set(`people:${person.id}`, person.name)
  for (const [kind, list] of [['places', places], ['subjects', subjects], ['genres', genres]] as const) {
    for (const t of list) names.set(`${kind}:${t.id}`, t.name)
  }
  const why = new Map(
    related.map((r) => [r.item.id, `Shared: ${r.shared.map((s) => names.get(`${s.kind as Kind}:${s.id}`)).filter(Boolean).join('; ')}`]),
  )
  const reviewer = typeof item.review?.reviewedBy === 'object' ? (item.review?.reviewedBy as User | null) : null
  const reviewed = item.review?.status === 'reviewed'
  const translation = item.translation?.text?.trim() ? item.translation : null
  const verifier = typeof translation?.verifiedBy === 'object' ? (translation?.verifiedBy as User | null) : null
  const translationStatus = !translation
    ? null
    : translation.status === 'human'
      ? { short: 'translated by project staff', long: `Translated by ${translation.translator || 'project staff'}.`, checked: true }
      : translation.status === 'verified'
        ? {
            short: 'AI translation, checked by staff',
            long: `Translated with AI${translation.model ? ` (${translation.model})` : ''} and checked against the original${verifier?.name ? ` by ${verifier.name}` : ' by project staff'}${translation.verifiedAt ? ` on ${new Date(translation.verifiedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}` : ''}.`,
            checked: true,
          }
        : {
            short: 'AI-generated, not yet checked',
            long: `Translated with AI${translation.model ? ` (${translation.model})` : ''} and not yet checked by project staff. It may contain errors; the original is authoritative.`,
            checked: false,
          }

  return (
    <article className="item">
      {item._status !== 'published' && (
        <p className="notice notice-draft" role="status">
          <strong>Draft — not public.</strong> Only signed-in project staff can see this page.
        </p>
      )}

      <header className="item-header">
        <p className="eyebrow">{item.itemId}</p>
        <h1>{item.title}</h1>
        <p className="item-date">{displayDate(item.date)}</p>
        {item._status === 'published' && !reviewed && (
          <p className="notice notice-unreviewed">
            This description and transcript were generated by AI and have not yet been reviewed by project staff. They may
            contain errors; the scans are the authoritative record.
          </p>
        )}
      </header>

      <div className="item-layout">
        <section className="item-pages" aria-label="Scans">
          {pages.map(({ media, label }, i) => (
            <figure key={media!.id} className="page">
              {(() => {
                const image = (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src(media!, 'reading')}
                    srcSet={fullResolution ? srcSet(media!) : srcSet(media!, ['thumbnail', 'card', 'reading'])}
                    sizes="(min-width: 960px) 55vw, 100vw"
                    alt={media!.alt}
                    width={media!.width ?? undefined}
                    height={media!.height ?? undefined}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                )
                return fullResolution ? (
                  <a href={media!.url ?? '#'} aria-label={`Open full-resolution scan of page ${i + 1}`}>
                    {image}
                  </a>
                ) : (
                  <div className="page-frame">{image}</div>
                )
              })()}
              <figcaption>
                Page {i + 1}
                {/* Labels such as "Recto" add information; "page 2" only repeats the number. */}
                {label && !/^page\s*\d+$/i.test(label.trim()) ? ` · ${label}` : ''}
              </figcaption>
            </figure>
          ))}
        </section>

        <div className="item-text">
          {item.description && (
            <section aria-labelledby="desc-heading">
              <h2 id="desc-heading">Description</h2>
              <p>{item.description}</p>
            </section>
          )}

          {people.length > 0 && (
            <section aria-labelledby="people-heading">
              <h2 id="people-heading">People</h2>
              <ul className="links" role="list">
                {people.map(({ person, role }) => (
                  <li key={`${person.id}-${role}`}>
                    <Link href={`/people/${person.slug}`}>{person.name}</Link>{' '}
                    <span className="role">{roleLabel[role]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <dl className="facts">
            {places.length > 0 && <Terms label="Place" base="/places" terms={places} />}
            {subjects.length > 0 && <Terms label="Subjects" base="/subjects" terms={subjects} />}
            {genres.length > 0 && <Terms label="Genre" base="/genres" terms={genres} />}
            {item.language && (
              <>
                <dt>Language</dt>
                <dd>{item.language}</dd>
              </>
            )}
            {translationStatus && (
              <>
                <dt>Translation</dt>
                <dd>
                  <a href="#translation">English</a> <span className="muted">({translationStatus.short})</span>
                </dd>
              </>
            )}
            {item.archival?.collection && (
              <>
                <dt>Collection</dt>
                <dd>{item.archival.collection}</dd>
              </>
            )}
            {rights && (
              <>
                <dt>Rights</dt>
                <dd>{rights}</dd>
              </>
            )}
          </dl>

          <aside className="provenance" aria-label="How this description was made">
            <p>
              The description and transcript were generated with AI from the scans
              {item.ai?.model ? ` (${item.ai.model})` : ''}.{' '}
              {reviewed ? (
                <>
                  Reviewed{reviewer?.name ? ` by ${reviewer.name}` : ''}
                  {item.review?.reviewedAt ? ` on ${new Date(item.review.reviewedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}` : ''}.
                </>
              ) : (
                <strong>Not yet reviewed by project staff.</strong>
              )}
            </p>
          </aside>

          <ContextEvents events={context.events} regions={item.regions ?? []} year={context.year} staff={context.staff} />
        </div>
      </div>

      {item.transcript && (
        <section className={`transcript${translation ? ' has-translation' : ''}`} aria-labelledby="transcript-heading">
          <h2 id="transcript-heading">{translation ? 'Transcript and translation' : 'Transcript'}</h2>
          <p className="transcript-note">
            Transcribed following the DAAHO Transcription Policy: original spelling is kept with corrections in
            [brackets]; [illegible] marks words that could not be read. The document&rsquo;s original wording is kept,
            including language that may be harmful &mdash; see our{' '}
            <Link href="/harmful-language">statement on potentially harmful language</Link>.
          </p>
          {annotations.pending > 0 && (
            <p className="notice notice-staff" role="status">
              {annotations.pending} {annotations.pending === 1 ? 'annotation is' : 'annotations are'} awaiting review and
              not shown here. <Link href="/review/annotations">Review annotations</Link>
            </p>
          )}
          {translationStatus && (
            <p className={`translation-status${translationStatus.checked ? ' is-checked' : ''}`}>
              <strong>About the English translation:</strong> {translationStatus.long}
            </p>
          )}
          <div className="transcript-columns">
            <div className="transcript-col">
              {translation && <h3 className="col-label">Original{item.language ? ` · ${item.language}` : ''}</h3>}
              <AnnotatedTranscript text={item.transcript} annotations={annotations.approved} lang={langAttr(item.language)} />
            </div>
            {translation && translationStatus && (
              <div className="transcript-col" id="translation">
                <h3 className="col-label">English translation</h3>
                <div className="transcript-body translation-body" lang="en">
                  {translation.text}
                </div>
                {translation.note && (
                  <p className="translation-note">
                    <strong>Note on the translation:</strong> {translation.note}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-heading">
          <h2 id="related-heading">Related items</h2>
          <ItemGrid items={related.map((r) => r.item)} notes={why} />
        </section>
      )}
    </article>
  )
}

function Terms({ label, base, terms }: { label: string; base: string; terms: { id: number; name: string; slug?: string | null }[] }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <ul className="inline-list" role="list">
          {terms.map((t) => (
            <li key={t.id}>
              <Link href={`${base}/${t.slug}`}>{t.name}</Link>
            </li>
          ))}
        </ul>
      </dd>
    </>
  )
}
