/**
 * Publish draft items in bulk.
 *
 *   EXCLUDE=AAMU-0087 pnpm publish:items:production
 *
 * Each item goes through the same publishing rules as the admin panel: a rights statement is needed
 * (its own or the default in Site settings), and review is needed unless Site settings allow
 * publishing before review — in which case the item's page says it is unreviewed. Nothing is marked
 * Reviewed by this script. Already-published items are skipped.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import type { Item } from '@/payload-types'

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

const exclude = new Set((process.env.EXCLUDE ?? '').split(',').map((s) => s.trim()).filter(Boolean))
console.log(`Database: ${describeDatabase()}`)
if (exclude.size) console.log(`Excluding: ${[...exclude].join(', ')}`)

const payload = await getPayload({ config })
const { docs } = await payload.find({ collection: 'items', pagination: false, depth: 0, draft: true, sort: 'itemId', overrideAccess: true })
let published = 0
let skipped = 0
const failed: string[] = []
for (const item of docs as Item[]) {
  if (exclude.has(item.itemId) || item._status === 'published') {
    skipped++
    continue
  }
  try {
    await payload.update({ collection: 'items', id: item.id, data: { _status: 'published' }, depth: 0, overrideAccess: true })
    published++
  } catch (err) {
    failed.push(`${item.itemId}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
console.log(`Published ${published}; skipped ${skipped} (excluded or already published); failed ${failed.length}.`)
for (const f of failed) console.log(`  ${f}`)
process.exit(failed.length ? 1 : 0)
