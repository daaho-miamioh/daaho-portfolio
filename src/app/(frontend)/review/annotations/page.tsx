import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getViewer } from '@/lib/viewer'
import type { Annotation, Item, User } from '@/payload-types'

import { reviewAnnotation } from './actions'

export const metadata: Metadata = { title: 'Review annotations', robots: { index: false } }

const CATEGORY: Record<string, string> = {
  context: 'Context',
  person: 'Person',
  place: 'Place',
  translation: 'Translation',
  correction: 'Correction',
  'harmful-language': 'Harmful language',
  other: 'Other',
}
const idOf = (v: number | { id: number } | null | undefined) => (typeof v === 'object' && v ? v.id : (v ?? undefined))
const nameOf = (u: number | User | null | undefined) => (u && typeof u === 'object' ? u.name || u.email : u ? `User ${u}` : '—')

/** Every annotation awaiting review, across all items, so reviewers need not open each item. */
export default async function ReviewAnnotationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { payload, user } = await getViewer()
  const role = (user as User | null)?.role
  if (!user || (role !== 'admin' && role !== 'editor')) notFound()
  const { status } = await searchParams

  const pending = (
    await payload.find({
      collection: 'annotations',
      where: { status: { equals: 'submitted' } },
      sort: 'createdAt',
      pagination: false,
      depth: 1,
      overrideAccess: false,
      user,
    })
  ).docs as Annotation[]

  return (
    <>
      <h1>Annotations awaiting review</h1>
      <p className="lede">
        Approving makes an annotation public on its item page. You cannot approve an annotation you wrote or last
        changed — another editor or admin has to. Returning sends it back to the author with your note.
      </p>
      {status && (
        <p className={`notice ${status.startsWith('Not done') ? 'notice-draft' : 'notice-staff'}`} role="status">
          {status}
        </p>
      )}
      <p>
        <strong>{pending.length}</strong> {pending.length === 1 ? 'annotation' : 'annotations'} to review.
      </p>

      {pending.map((a) => {
        const item = typeof a.item === 'object' ? (a.item as Item) : null
        const mine = user.id === idOf(a.author) || user.id === idOf(a.lastEditedBy)
        return (
          <form key={a.id} action={reviewAnnotation} className="cluster">
            <input type="hidden" name="id" value={a.id} />
            <fieldset>
              <legend>
                {item ? (
                  <>
                    {item.itemId} · {item.title}
                  </>
                ) : (
                  `Item ${a.item}`
                )}
              </legend>
              <p className="annotation-quote">
                <span className="muted">…{a.prefix}</span>
                <mark>{a.quote}</mark>
                <span className="muted">{a.suffix}…</span>
              </p>
              <p>
                <strong>{CATEGORY[a.category] ?? a.category}:</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{a.body}</span>
              </p>
              <p className="muted">
                By {nameOf(a.author as User)}
                {idOf(a.lastEditedBy) !== idOf(a.author) ? ` · last changed by ${nameOf(a.lastEditedBy as User)}` : ''}
                {item && (
                  <>
                    {' · '}
                    <Link href={`/admin/collections/items/${item.id}`}>open in the editor</Link>
                  </>
                )}
              </p>
              {mine ? (
                <p className="notice notice-draft">You wrote or last changed this one, so another editor or admin needs to review it.</p>
              ) : (
                <>
                  <label htmlFor={`note-${a.id}`}>Note to the author (required when returning)</label>
                  <textarea id={`note-${a.id}`} name="reviewNote" rows={2} />
                  <div className="cluster-actions">
                    <button type="submit" name="intent" value="approve" className="button">
                      Approve and publish
                    </button>{' '}
                    <button type="submit" name="intent" value="return" className="button-secondary">
                      Return to author
                    </button>
                  </div>
                </>
              )}
            </fieldset>
          </form>
        )
      })}
    </>
  )
}
