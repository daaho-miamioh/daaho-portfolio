/**
 * Fill `regions` on items that have none, from their title, description, places, subjects and
 * language. Never overwrites a value an editor has set. Safe to re-run.
 *
 *   pnpm backfill:regions
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { detectRegions } from '@/lib/regions'
import type { Item } from '@/payload-types'

const payload = await getPayload({ config })
const names = (xs: unknown[] | null | undefined) =>
  (xs ?? []).map((x) => (x && typeof x === 'object' && 'name' in x ? String((x as { name: string }).name) : '')).filter(Boolean)

const { docs } = await payload.find({ collection: 'items', pagination: false, depth: 1, draft: true, overrideAccess: true })
let filled = 0
let skipped = 0
for (const item of docs as Item[]) {
  if (item.regions?.length) continue
  const regions = detectRegions({
    title: item.title,
    description: item.description,
    places: names(item.places),
    subjects: names(item.subjects),
    language: item.language,
  })
  if (!regions.length) continue
  const main = await payload.findByID({ collection: 'items', id: item.id, draft: false, depth: 0, overrideAccess: true })
  if (main._status === 'published' && item._status !== 'published') {
    console.log(`  skipped ${item.itemId}: published with unpublished changes`)
    skipped++
    continue
  }
  await payload.update({ collection: 'items', id: item.id, data: { regions, _status: item._status ?? 'draft' }, depth: 0, overrideAccess: true })
  filled++
}
console.log(`Filled regions on ${filled} items; ${skipped} skipped; ${docs.length - filled - skipped} unchanged.`)
process.exit(0)
