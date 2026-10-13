import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { hasRole } from '@/access/roles'
import { contextAround, locate } from '@/lib/anchors'

const idOf = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number }).id : (v as number | null | undefined))
const CONTENT = ['quote', 'body', 'category'] as const

/**
 * The review rule for annotations, enforced on every save however it arrives:
 *   - anyone signed in may write one; it is never public until approved;
 *   - only editors and admins approve or reject;
 *   - nobody approves an annotation they wrote or last changed, so every public annotation has had
 *     two people;
 *   - changing an approved annotation's text sends it back for review.
 */
export const reviewRule: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  const user = req.user
  const before = originalDoc ?? {}
  const contentChanged = operation === 'create' || CONTENT.some((k) => k in data && data[k] !== before[k])

  // Who wrote and who last changed it come from the stored record and the signed-in user, never from
  // the request body, so they cannot be forged to get around the two-person rule.
  data.author = operation === 'create' ? (user?.id ?? idOf(data.author) ?? null) : idOf(before.author) ?? null
  data.lastEditedBy = contentChanged ? (user?.id ?? idOf(data.lastEditedBy) ?? null) : idOf(before.lastEditedBy) ?? null
  data.reviewedBy = idOf(before.reviewedBy) ?? null
  data.reviewedAt = before.reviewedAt ?? null

  let next: string = data.status ?? before.status ?? 'submitted'
  // Changing the text of a decided annotation reopens it. Whoever changed it is now its last editor and
  // so cannot be the one to approve the new text.
  if (operation === 'update' && contentChanged && (before.status === 'approved' || before.status === 'rejected')) {
    if (next === 'approved' || next === 'rejected') next = 'submitted'
  }

  const deciding = (next === 'approved' || next === 'rejected') && next !== before.status
  if (deciding) {
    // Access control already limits contributors to their own annotations, which the next check
    // forbids them to approve; this stays in case that access rule is ever widened.
    if (user && !hasRole(req, 'admin', 'editor')) {
      throw new APIError('Only editors and admins can approve or return annotations.', 403)
    }
    if (user && (user.id === data.author || user.id === data.lastEditedBy)) {
      throw new APIError('An annotation must be reviewed by someone other than the person who wrote or last changed it.', 403)
    }
    data.reviewedBy = user?.id ?? null
    data.reviewedAt = new Date().toISOString()
  } else if (next !== 'approved' && next !== 'rejected') {
    data.reviewedBy = null
    data.reviewedAt = null
  }
  data.status = next
  return data
}

/** The quoted passage must exist in the item's transcript; record where, with context to find it again. */
export const anchorToTranscript: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const quote = data.quote ?? originalDoc?.quote
  const itemId = idOf(data.item ?? originalDoc?.item)
  if (!quote || !itemId) return data
  if (originalDoc && data.quote === undefined && data.item === undefined) return data
  const item = await req.payload.findByID({ collection: 'items', id: itemId, depth: 0, draft: true, req, overrideAccess: true })
  const transcript = item.transcript ?? ''
  const range = locate(transcript, { quote, prefix: data.prefix, suffix: data.suffix, start: data.start })
  if (!range) throw new APIError('The selected text was not found in this item\'s transcript.', 400)
  Object.assign(data, { start: range.start, end: range.end }, contextAround(transcript, range.start, range.end))
  return data
}
