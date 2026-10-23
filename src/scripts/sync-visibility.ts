/**
 * Bring every record in line with the public-view rules at once, which the hooks otherwise do one
 * item at a time as items are saved:
 *   - each item's public search text and public date (hooks/items.ts derivePublic), and its scans'
 *     alternative text (syncVisibility), for items saved before these rules;
 *   - which people are public: only those named in a published item whose people staff have checked
 *     (hooks/items.ts syncVisibility).
 * Run after the rules change, or after bulk edits made outside the admin. Changes nothing else.
 *
 *   pnpm sync:visibility               local database
 *   pnpm sync:visibility:production    the live database
 */
import { getPayload } from 'payload'

import config from '@payload-config'
import type { Item } from '@/payload-types'

const payload = await getPayload({ config })

const all = (await payload.find({ collection: 'items', pagination: false, depth: 0, draft: true, overrideAccess: true })).docs as Item[]
let refreshed = 0
for (const item of all) {
  // Saving runs the hooks: public search text and date, and the scans' alternative text, all from
  // the stored record. A draft stays a draft; nothing else changes.
  await payload.update({
    collection: 'items',
    id: item.id,
    data: { _status: item._status } as Partial<Item>,
    draft: item._status !== 'published',
    depth: 0,
    overrideAccess: true,
  })
  refreshed++
}
console.log(`Items refreshed (public search text, public date, scan alt text): ${refreshed} of ${all.length}.`)
const items = (
  await payload.find({
    collection: 'items',
    where: { and: [{ _status: { equals: 'published' } }, { 'review.linksChecked': { equals: true } }] },
    pagination: false,
    depth: 0,
    select: { people: true },
    overrideAccess: true,
  })
).docs as Pick<Item, 'id' | 'people'>[]

const shown = new Set<number>()
for (const it of items) for (const r of it.people ?? []) shown.add(typeof r.person === 'object' ? r.person.id : r.person)

const people = (await payload.find({ collection: 'people', pagination: false, depth: 0, draft: true, select: { public: true }, overrideAccess: true })).docs
let changed = 0
for (const p of people) {
  const should = shown.has(p.id)
  if (!!p.public === should) continue
  await payload.update({ collection: 'people', id: p.id, data: { public: should }, depth: 0, overrideAccess: true })
  changed++
}
console.log(`People: ${people.length}. Public now: ${shown.size}. Changed: ${changed}.`)
process.exit(0)
