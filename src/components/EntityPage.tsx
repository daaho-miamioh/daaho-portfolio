import { RichText } from '@payloadcms/richtext-lexical/react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Where } from 'payload'

import { PERSON_ROLES } from '@/collections/Items'
import { ItemGrid } from '@/components/ItemCard'
import { getViewer } from '@/lib/viewer'
import type { Item, Person } from '@/payload-types'

type Kind = 'people' | 'places' | 'subjects' | 'genres'

const LABEL: Record<Kind, string> = { people: 'Person', places: 'Place', subjects: 'Subject', genres: 'Genre' }
const roleLabel = Object.fromEntries(PERSON_ROLES.map((r) => [r.value, r.label]))

export async function loadEntity(kind: Kind, slug: string) {
  const { payload, draft, access } = await getViewer()
  const res = await payload.find({ collection: kind, where: { slug: { equals: slug } }, limit: 1, depth: 1, draft, ...access })
  return res.docs[0]
}

export async function EntityPage({ kind, slug }: { kind: Kind; slug: string }) {
  const { payload, user, draft, access } = await getViewer()
  const entity = await loadEntity(kind, slug)
  if (!entity) notFound()

  const where: Where = kind === 'people' ? { 'people.person': { equals: entity.id } } : { [kind]: { in: [entity.id] } }
  const items = (
    await payload.find({ collection: 'items', where, sort: 'dateSort', limit: 200, depth: 1, draft, ...access })
  ).docs as Item[]

  // Places and subjects are controlled headings and readable by anyone, but a public page listing
  // nothing is a dead end: show it only once a published item links to it.
  if (!user && items.length === 0) notFound()

  const person = kind === 'people' ? (entity as Person) : null
  const notes = new Map<number, string>()
  if (person) {
    for (const item of items) {
      const roles = (item.people ?? [])
        .filter((r) => (typeof r.person === 'object' ? r.person?.id : r.person) === person.id)
        .map((r) => roleLabel[r.role])
      if (roles.length) notes.set(item.id, roles.join(', '))
    }
  }

  const body = person ? person.bio : 'description' in entity ? entity.description : null
  const aliases = person?.aliases?.map((a) => a.value).filter((a) => a !== person.name) ?? []
  const duplicates = (person?.possibleDuplicates ?? []).filter((d): d is Person => typeof d === 'object' && !!d)
  const authority = 'authorityUri' in entity ? entity.authorityUri : null

  return (
    <article>
      <header className="entity-header">
        <p className="eyebrow">{person && person.kind !== 'person' ? (person.kind === 'organization' ? 'Organization' : 'Group') : LABEL[kind]}</p>
        <h1>{entity.name}</h1>
        {person?.dates && <p className="item-date">{person.dates}</p>}
        {aliases.length > 0 && <p className="aliases">Also written in the documents as: {aliases.join('; ')}</p>}
        {authority && (
          <p>
            <a href={authority} rel="noopener noreferrer">
              Authority record
            </a>
          </p>
        )}
      </header>

      {body && (
        <div className="prose">
          <RichText data={body} />
        </div>
      )}

      {user && (person?.needsReview || duplicates.length > 0) && (
        <aside className="notice notice-staff" aria-label="For project staff">
          <p>
            <strong>For staff:</strong>{' '}
            {person?.needsReview && 'the reading of this name in the source was uncertain. '}
            {duplicates.length > 0 && (
              <>
                possibly the same as{' '}
                {duplicates.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ', '}
                    <Link href={`/people/${d.slug}`}>{d.name}</Link>
                  </span>
                ))}
                . Confirm or clear in the CMS.
              </>
            )}
          </p>
        </aside>
      )}

      <section aria-labelledby="related-heading">
        <h2 id="related-heading">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </h2>
        <ItemGrid items={items} notes={notes} />
      </section>
    </article>
  )
}
