import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook } from 'payload'

import { hasRole } from '@/access/roles'
import { sortableDate } from '@/lib/dates'

type Page = { image?: number | { id: number } | null }
const mediaIds = (pages: Page[] | null | undefined) =>
  (pages ?? [])
    .map((p) => (typeof p.image === 'object' && p.image ? p.image.id : p.image))
    .filter((id): id is number => typeof id === 'number')

/**
 * The two rules an archival site has to enforce, not merely document:
 * an AI-generated description is not published until a person has reviewed it, and nothing is
 * published without a rights statement. Contributors draft; only editors and admins publish.
 */
export const publishGate: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (data._status !== 'published') return data
  if (req.user && !hasRole(req, 'admin', 'editor')) {
    throw new APIError('Contributors can save drafts but cannot publish. Ask an editor to publish.', 403)
  }
  const status = data.review?.status ?? originalDoc?.review?.status
  const rights = (data.rights ?? originalDoc?.rights ?? '').trim()
  const missing = [
    status !== 'reviewed' && 'mark the description as Reviewed',
    !rights && 'add a rights statement',
  ].filter(Boolean)
  if (missing.length) throw new APIError(`Before publishing: ${missing.join(' and ')}.`, 400)
  return data
}

/** Record who reviewed a description and when, so the public page can say so truthfully. */
export const stampReview: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const review = { ...(originalDoc?.review ?? {}), ...(data.review ?? {}) }
  const wasReviewed = originalDoc?.review?.status === 'reviewed'
  if (review.status === 'reviewed' && !wasReviewed) {
    review.reviewedBy = req.user?.id ?? null
    review.reviewedAt = new Date().toISOString()
  } else if (review.status !== 'reviewed') {
    review.reviewedBy = null
    review.reviewedAt = null
  }
  data.review = review
  return data
}

export const deriveDateSort: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  data.dateSort = sortableDate(data.date ?? originalDoc?.date)
  return data
}

type PersonRow = { person?: number | { id: number } | null }
const personIds = (rows: PersonRow[] | null | undefined) =>
  (rows ?? [])
    .map((r) => (typeof r.person === 'object' && r.person ? r.person.id : r.person))
    .filter((id): id is number => typeof id === 'number')

/**
 * Keep public visibility in step with what is actually published: an item's scans, and the people it
 * names, are public only while some published item shows them. The hook cannot tell a draft save
 * from an unpublish, so it asks the database for the published state instead of guessing.
 */
export const syncVisibility: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const published = await req.payload
    .findByID({ collection: 'items', id: doc.id, draft: false, depth: 0, req, overrideAccess: true })
    .catch(() => null)
  const isPublished = published?._status === 'published'

  const visibleMedia = new Set(isPublished ? mediaIds(published.pages) : [])
  for (const id of new Set([...mediaIds(doc.pages), ...mediaIds(previousDoc?.pages), ...visibleMedia])) {
    await req.payload.update({ collection: 'media', id, data: { public: visibleMedia.has(id) }, req, overrideAccess: true })
  }

  // A person can appear in several items, so their visibility depends on all of them, not this one.
  const people = new Set([...personIds(doc.people), ...personIds(previousDoc?.people), ...personIds(published?.people)])
  for (const id of people) {
    const { totalDocs } = await req.payload.count({
      collection: 'items',
      where: { and: [{ 'people.person': { equals: id } }, { _status: { equals: 'published' } }] },
      req,
      overrideAccess: true,
    })
    await req.payload.update({ collection: 'people', id, data: { public: totalDocs > 0 }, req, overrideAccess: true })
  }
  return doc
}
