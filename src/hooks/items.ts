import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionAfterReadHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
} from 'payload'

import { hasRole } from '@/access/roles'
import { sortableDate } from '@/lib/dates'
import { CHECKS, publicSearchText, stripForPublic } from '@/lib/publicView'

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
export const publishGate: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (data._status !== 'published') return data
  if (req.user && !hasRole(req, 'admin', 'editor')) {
    throw new APIError('Contributors can save drafts but cannot publish. Ask an editor to publish.', 403)
  }
  // Reviewed means every AI-drafted part has been checked (see src/lib/publicView.ts).
  const review = { ...(originalDoc?.review ?? {}), ...(data.review ?? {}) }
  const allChecked = CHECKS.every((c) => review[c.name] === true)
  // The site-wide statement in Site settings covers items without their own.
  const settings = await req.payload.findGlobal({ slug: 'settings', req, depth: 0, overrideAccess: true })
  const rights = (data.rights ?? originalDoc?.rights ?? settings.defaultRights ?? '').trim()
  // The project may publish before review; the item page then says it is unreviewed. What it may not
  // do is mark an item Reviewed that nobody reviewed, so the switch exists instead of a bulk "Reviewed".
  const reviewOk = allChecked || !!settings.allowUnreviewedPublishing
  const missing = [
    !reviewOk && 'check every part under Checked by staff (or allow publishing before review in Site settings)',
    !rights && 'add a rights statement (on the item, or a default in Site settings)',
  ].filter(Boolean)
  if (missing.length) throw new APIError(`Before publishing: ${missing.join(' and ')}.`, 400)
  return data
}

/**
 * Record who reviewed a record and when, from its review status. Used by Historical contexts
 * (collections/Events.ts); items record their reviews per part, with stampChecks.
 */
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

/**
 * Record who last checked part of an item, and when, so the public page can say so truthfully. The
 * overall status follows the checks: Reviewed once all four parts are checked, In review once any is.
 */
export const stampChecks: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const before = originalDoc?.review ?? {}
  const review = { ...before, ...(data.review ?? {}) }
  const newlyChecked = CHECKS.some((c) => review[c.name] === true && before[c.name] !== true)
  const checkedCount = CHECKS.filter((c) => review[c.name] === true).length
  if (newlyChecked) {
    review.reviewedBy = req.user?.id ?? null
    review.reviewedAt = new Date().toISOString()
  } else if (checkedCount === 0) {
    review.reviewedBy = null
    review.reviewedAt = null
  }
  review.status = checkedCount === CHECKS.length ? 'reviewed' : checkedCount > 0 ? 'in_review' : 'ai_generated'
  data.review = review
  return data
}

/**
 * Who verified a translation, and when. Verification belongs to the text that was checked: when a
 * person edits a verified translation they become its verifier; when a script or import replaces
 * it, it goes back to unverified.
 */
export const stampTranslation: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!data.translation && !originalDoc?.translation) return data
  const before = originalDoc?.translation ?? {}
  const t = { ...before, ...(data.translation ?? {}) }
  const textChanged = (t.text ?? '') !== (before.text ?? '')
  if (textChanged && !req.user && t.status === 'verified') t.status = 'ai'
  if (t.status === 'verified') {
    if (before.status !== 'verified' || textChanged) {
      t.verifiedBy = req.user?.id ?? null
      t.verifiedAt = new Date().toISOString()
    } else {
      t.verifiedBy = typeof before.verifiedBy === 'object' && before.verifiedBy ? before.verifiedBy.id : (before.verifiedBy ?? null)
      t.verifiedAt = before.verifiedAt ?? null
    }
  } else {
    t.verifiedBy = null
    t.verifiedAt = null
  }
  data.translation = t
  return data
}

/**
 * What the public search and the public date order use: built only from checked parts (see
 * src/lib/publicView.ts), so hidden AI text can never be found, nor sort an item into a decade.
 */
export const derivePublic: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const o = originalDoc ?? {}
  const merged = {
    ...o,
    ...data,
    review: { ...(o.review ?? {}), ...(data.review ?? {}) },
    archival: { ...(o.archival ?? {}), ...(data.archival ?? {}) },
    translation: { ...(o.translation ?? {}), ...(data.translation ?? {}) },
  }
  data.publicText = publicSearchText(merged)
  data.publicDateSort = merged.review?.titleChecked ? sortableDate(merged.date) : null
  return data
}

/** Visitors who are not signed in read only the checked parts. Staff and the site's own code read everything. */
export const hideUnchecked: CollectionAfterReadHook = ({ doc, req, overrideAccess }) =>
  req.user || overrideAccess ? doc : stripForPublic(doc)

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
  // Each scan's alternative text names its item by a title someone has checked, or else only by its
  // ID: the media library is public, and an AI title (with misread names and dates) must not leak there.
  const altFor = new Map<number, string>()
  const name = doc.review?.titleChecked ? `“${doc.title}”` : doc.itemId
  ;(doc.pages ?? []).forEach((p: Page & { label?: string | null }, i: number) => {
    const id = mediaIds([p])[0]
    const label = p.label && !/^page\s*\d+$/i.test(p.label.trim()) ? ` (${p.label.trim()})` : ''
    if (id) altFor.set(id, `Page ${i + 1}${label} of ${name}`)
  })
  for (const id of new Set([...mediaIds(doc.pages), ...mediaIds(previousDoc?.pages), ...visibleMedia])) {
    const data: { public: boolean; alt?: string } = { public: visibleMedia.has(id) }
    if (altFor.has(id)) data.alt = altFor.get(id)
    await req.payload.update({ collection: 'media', id, data, req, overrideAccess: true })
  }

  // A person can appear in several items, so their visibility depends on all of them, not this one.
  const people = new Set([...personIds(doc.people), ...personIds(previousDoc?.people), ...personIds(published?.people)])
  for (const id of people) {
    const { totalDocs } = await req.payload.count({
      collection: 'items',
      // Names the AI found are public only once someone has checked the item's people.
      where: { and: [{ 'people.person': { equals: id } }, { _status: { equals: 'published' } }, { 'review.linksChecked': { equals: true } }] },
      req,
      overrideAccess: true,
    })
    await req.payload.update({ collection: 'people', id, data: { public: totalDocs > 0 }, req, overrideAccess: true })
  }
  return doc
}

/** An item's annotations go with it. They must go first: the item column is required, so the database cannot leave them behind. */
export const deleteAnnotations: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({ collection: 'annotations', where: { item: { equals: id } }, req, overrideAccess: true })
}
