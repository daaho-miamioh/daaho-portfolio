import {
  APIError,
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

import type { Item, Person, User } from '@/payload-types'

/**
 * Merge duplicate people records into one, as a single transaction.
 *
 * The importer only proposes duplicates ("Upham, A. H." / "Upham, Alfred H."); a person decides.
 * Merging repoints every item at the surviving record, folds the other spellings into its aliases,
 * records what was merged — so the importer maps those names to the survivor instead of recreating
 * them — and deletes the merged records. Any failure rolls the whole merge back.
 */

const ROLE_RANK: Record<string, number> = { creator: 0, correspondent: 1, contributor: 2 }
type Row = NonNullable<Item['people']>[number]
const idOf = (v: number | { id: number } | null | undefined) => (typeof v === 'object' && v ? v.id : v ?? undefined)

function canEdit(user: User | null | undefined) {
  return user?.role === 'admin' || user?.role === 'editor'
}

/** Repoint rows at the survivor; one row per person, keeping the most significant role. */
export function remapRows(rows: Row[], merged: Set<number>, survivor: number): Row[] {
  const best = new Map<number, Row>()
  const order: number[] = []
  for (const row of rows) {
    const original = idOf(row.person)
    if (original === undefined) continue
    const person = merged.has(original) ? survivor : original
    const current = best.get(person)
    if (!current) order.push(person)
    if (!current || ROLE_RANK[row.role] < ROLE_RANK[current.role]) best.set(person, { person, role: row.role })
  }
  return order.map((id) => best.get(id)!)
}

async function inTransaction<T>(payload: Payload, user: User, work: (req: PayloadRequest) => Promise<T>): Promise<T> {
  const req = await createLocalReq({ user }, payload)
  const started = await initTransaction(req)
  try {
    const result = await work(req)
    if (started) await commitTransaction(req)
    return result
  } catch (err) {
    if (started) await killTransaction(req)
    throw err
  }
}

export async function mergePeople(
  payload: Payload,
  user: User,
  survivorId: number,
  mergedIds: number[],
): Promise<{ itemsUpdated: number; merged: string[] }> {
  if (!canEdit(user)) throw new APIError('Only editors and admins can merge people.', 403)
  const merged = new Set(mergedIds.filter((id) => id !== survivorId))
  if (!merged.size) throw new APIError('Choose at least one record to merge into the one you keep.', 400)

  return inTransaction(payload, user, async (req) => {
    const opts = { req, depth: 0, draft: true, overrideAccess: true } as const
    const survivor = (await payload.findByID({ collection: 'people', id: survivorId, ...opts })) as Person
    const others = (await Promise.all([...merged].map((id) => payload.findByID({ collection: 'people', id, ...opts })))) as Person[]

    // 1. Repoint items, keeping each item's publication state exactly as it was.
    const affected = await payload.find({
      collection: 'items',
      where: { 'people.person': { in: [...merged] } },
      pagination: false,
      ...opts,
    })
    const latest = affected.docs as Item[]
    // An item published with newer, unpublished changes has two versions that would both need the
    // change, and saving one can publish or discard the other. Refuse before writing anything.
    const pending: string[] = []
    for (const item of latest) {
      const main = await payload.findByID({ collection: 'items', id: item.id, draft: false, depth: 0, req, overrideAccess: true })
      if (main._status === 'published' && item._status !== 'published') pending.push(item.itemId)
    }
    if (pending.length) {
      throw new APIError(`Publish or discard the pending changes on ${pending.join(', ')} before merging.`, 409)
    }
    for (const item of latest) {
      // Saved as the main document, with its status passed through unchanged: a draft-only save would
      // leave the main row pointing at a record this merge then deletes.
      await payload.update({
        collection: 'items',
        id: item.id,
        data: { people: remapRows(item.people ?? [], merged, survivorId), _status: item._status ?? 'draft' },
        req,
        depth: 0,
        overrideAccess: true,
      })
    }

    // 2. Fold the merged records into the survivor.
    const names = new Set<string>()
    for (const p of [survivor, ...others]) {
      for (const a of p.aliases ?? []) names.add(a.value)
      names.add(p.name)
    }
    names.delete(survivor.name)
    const duplicates = new Set<number>()
    for (const p of [survivor, ...others]) for (const d of p.possibleDuplicates ?? []) duplicates.add(idOf(d)!)
    for (const id of [survivorId, ...merged]) duplicates.delete(id)
    const now = new Date().toISOString()
    const mergedFrom = [
      ...(survivor.mergedFrom ?? []).map(({ name, importKey, mergedAt, mergedBy }) => ({ name, importKey, mergedAt, mergedBy: idOf(mergedBy) })),
      ...others.flatMap((p) => [
        { name: p.name, importKey: p.importKey ?? null, mergedAt: now, mergedBy: user.id },
        ...(p.mergedFrom ?? []).map(({ name, importKey, mergedAt, mergedBy }) => ({ name, importKey, mergedAt, mergedBy: idOf(mergedBy) })),
      ]),
    ]
    const withBio = others.filter((p) => p.bio)
    await payload.update({
      collection: 'people',
      id: survivorId,
      data: {
        aliases: [...names].sort().map((value) => ({ value })),
        possibleDuplicates: [...duplicates],
        mergedFrom,
        needsReview: [survivor, ...others].some((p) => p.needsReview),
        dates: survivor.dates || others.find((p) => p.dates)?.dates || null,
        bio: survivor.bio ?? (withBio.length === 1 ? withBio[0].bio : survivor.bio),
      },
      draft: survivor._status !== 'published',
      req,
      depth: 0,
      overrideAccess: true,
    })

    // 3. Anyone else who listed a merged record as a possible duplicate now points at the survivor.
    const pointing = await payload.find({
      collection: 'people',
      where: { possibleDuplicates: { in: [...merged] } },
      pagination: false,
      ...opts,
    })
    for (const p of pointing.docs as Person[]) {
      if (p.id === survivorId) continue
      const next = new Set((p.possibleDuplicates ?? []).map((d) => idOf(d)!).map((id) => (merged.has(id) ? survivorId : id)))
      next.delete(p.id)
      await payload.update({ collection: 'people', id: p.id, data: { possibleDuplicates: [...next] }, req, depth: 0, overrideAccess: true })
    }

    // 4. Remove the merged records.
    for (const id of merged) await payload.delete({ collection: 'people', id, req, overrideAccess: true })

    return { itemsUpdated: affected.totalDocs, merged: others.map((p) => p.name) }
  })
}

/** An editor decided these are different people: stop proposing them as duplicates of each other. */
export async function markNotDuplicates(payload: Payload, user: User, ids: number[]): Promise<void> {
  if (!canEdit(user)) throw new APIError('Only editors and admins can review duplicates.', 403)
  const set = new Set(ids)
  if (set.size < 2) throw new APIError('Choose at least two records.', 400)
  await inTransaction(payload, user, async (req) => {
    for (const id of set) {
      const p = (await payload.findByID({ collection: 'people', id, req, depth: 0, draft: true, overrideAccess: true })) as Person
      const next = (p.possibleDuplicates ?? []).map((d) => idOf(d)!).filter((d) => !set.has(d))
      await payload.update({ collection: 'people', id, data: { possibleDuplicates: next }, req, depth: 0, overrideAccess: true })
    }
  })
}
