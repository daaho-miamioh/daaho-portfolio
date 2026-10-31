/**
 * Create the collections within the collection, and put items into them.
 *
 *   pnpm import:sets                    local database
 *   DRY_RUN=1 pnpm import:sets          list what would change, change nothing
 *   pnpm import:sets:production         the live database
 *
 * Reads data/catalog/sets.json. A collection the site does not have yet is created, published, with
 * the texts there as a first draft. Every item without a collection goes into the one whose prefix
 * its item ID starts with. Nothing already set is changed, so it is safe to run again, and to run
 * after each import.
 */
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { Item, ItemSet } from '@/payload-types'

const LIST = path.resolve('data/catalog/sets.json')
const DRY_RUN = !!process.env.DRY_RUN

type Entry = Pick<ItemSet, 'slug' | 'title' | 'shortTitle' | 'kind' | 'color' | 'order' | 'summary' | 'holder' | 'url'> & { slug: string; prefix: string }

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

async function main() {
  const { sets } = JSON.parse(fs.readFileSync(LIST, 'utf8')) as { sets: Entry[] }
  console.log(`Target database: ${describeDatabase()}${DRY_RUN ? '  [dry run: nothing is written]' : ''}`)
  const payload = await getPayload({ config })
  if (process.env.NODE_ENV === 'production') {
    const applied = await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0)
    if (!applied) {
      console.error('\nThis database has no migrations applied, so it is not the database your deployment uses. Stopping.\n')
      process.exit(1)
    }
  }

  const ids = new Map<string, number>()
  const created: string[] = []
  for (const e of sets) {
    const found = (await payload.find({ collection: 'sets', where: { slug: { equals: e.slug } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs[0] as ItemSet | undefined
    if (found) {
      ids.set(e.prefix, found.id)
      continue
    }
    created.push(e.title)
    if (DRY_RUN) {
      ids.set(e.prefix, -1)
      continue
    }
    const doc = (await payload.create({
      collection: 'sets',
      data: {
        title: e.title,
        slug: e.slug,
        shortTitle: e.shortTitle,
        kind: e.kind,
        color: e.color,
        summary: e.summary,
        holder: e.holder,
        url: e.url,
        order: e.order,
        _status: 'published',
      },
      overrideAccess: true,
    })) as ItemSet
    ids.set(e.prefix, doc.id)
  }

  const items = (await payload.find({ collection: 'items', pagination: false, depth: 0, draft: true, overrideAccess: true, select: { itemId: true, set: true, _status: true } }))
    .docs as Pick<Item, 'id' | 'itemId' | 'set' | '_status'>[]
  const placed = new Map<string, number>()
  const unmatched: string[] = []
  const skipped: string[] = []
  const failed: string[] = []
  for (const item of items) {
    if (item.set) continue
    const entry = sets.find((e) => item.itemId.startsWith(e.prefix))
    if (!entry) {
      unmatched.push(item.itemId)
      continue
    }
    // As in backfill-regions: saving would publish an editor's unpublished changes along with ours.
    const main = await payload.findByID({ collection: 'items', id: item.id, draft: false, depth: 0, overrideAccess: true })
    if (main._status === 'published' && item._status !== 'published') {
      skipped.push(item.itemId)
      continue
    }
    if (!DRY_RUN) {
      try {
        await payload.update({ collection: 'items', id: item.id, data: { set: ids.get(entry.prefix), _status: item._status ?? 'draft' }, depth: 0, overrideAccess: true })
      } catch (err) {
        // e.g. the publishing rules in Site settings now refuse an item published under looser ones.
        failed.push(`${item.itemId} (${(err as Error).message})`)
        continue
      }
    }
    placed.set(entry.title, (placed.get(entry.title) ?? 0) + 1)
  }

  console.log(
    `\n${DRY_RUN ? 'Would create' : 'Created'} collections: ${created.join('; ') || 'none'}\n` +
      `${DRY_RUN ? 'Would place' : 'Placed'} items:\n${[...placed].map(([t, n]) => `  ${n} in ${t}`).join('\n') || '  none'}\n` +
      `Published with unpublished changes, left for an editor: ${skipped.join(', ') || 'none'}\n` +
      `No collection matches their ID: ${unmatched.join(', ') || 'none'}\n` +
      `Could not be saved: ${failed.join('; ') || 'none'}`,
  )
  process.exit(0)
}

// `payload run` exits once this module finishes evaluating, so the work must be awaited here.
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
