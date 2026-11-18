/**
 * Delete uploaded files (Media) whose original filename starts with a prefix, from the database and
 * from storage. For scans superseded by a new set, e.g. Alia's Asian Festival scans after CML's.
 *
 *   PREFIX=AsianFest_1996_ pnpm delete:media                       # local: report only
 *   PREFIX=AsianFest_1996_ CONFIRM=yes pnpm delete:media:production  # the live site: delete
 *   ITEMS=AF-1997,AF-2002 PREFIX=AsianFest_ CONFIRM=yes pnpm delete:media:production
 *       # first delete those items (only unreviewed drafts), then the files no item shows
 *
 * Without CONFIRM=yes it only reports. It never deletes a file that an item's current version
 * shows (published or the latest draft): replace or delete that item first. Older versions that
 * still point at a deleted file keep the page with no image.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

const PREFIX = process.env.PREFIX
const CONFIRM = process.env.CONFIRM === 'yes'

async function main() {
  if (!PREFIX || PREFIX.length < 4) throw new Error('Set PREFIX to the start of the original filenames to delete (at least 4 characters).')
  const payload = await getPayload({ config })

  // Items to delete first: only drafts nobody has reviewed, so nothing published or checked is lost.
  for (const itemId of (process.env.ITEMS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const item = (await payload.find({ collection: 'items', where: { itemId: { equals: itemId } }, draft: true, depth: 0, limit: 1, overrideAccess: true }))
      .docs[0] as { id: number; _status?: string | null; review?: Record<string, unknown> | null } | undefined
    if (!item) {
      console.log(`  item ${itemId}: not found`)
      continue
    }
    const checked = ['titleChecked', 'descriptionChecked', 'transcriptChecked', 'linksChecked'].some((k) => item.review?.[k])
    // ALLOW_PUBLISHED=1 lifts this for a local development database only, never the live site.
    const allowPublished = process.env.ALLOW_PUBLISHED === '1' && process.env.NODE_ENV !== 'production'
    if ((item._status === 'published' || checked) && !allowPublished) {
      console.log(`  item ${itemId}: published or partly reviewed; kept`)
      continue
    }
    if (CONFIRM) await payload.delete({ collection: 'items', id: item.id, overrideAccess: true })
    console.log(`  item ${itemId}: ${CONFIRM ? 'deleted' : 'would be deleted'}`)
  }

  const { docs } = await payload.find({
    collection: 'media',
    where: { sourceFilename: { like: `${PREFIX}%` } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const media = (docs as { id: number; sourceFilename?: string | null; filesize?: number | null }[]).filter((m) =>
    (m.sourceFilename ?? '').startsWith(PREFIX),
  )
  // What items show now: the latest version of each, drafts included.
  const items = (await payload.find({ collection: 'items', draft: true, depth: 0, pagination: false, overrideAccess: true })).docs as {
    itemId: string
    pages?: { image: number | { id: number } }[] | null
    recording?: number | { id: number } | null
  }[]
  const inUse = new Map<number, string>()
  for (const it of items) {
    for (const p of it.pages ?? []) inUse.set(typeof p.image === 'number' ? p.image : p.image.id, it.itemId)
    if (it.recording) inUse.set(typeof it.recording === 'number' ? it.recording : it.recording.id, it.itemId)
  }
  const blocked = media.filter((m) => inUse.has(m.id))
  const free = media.filter((m) => !inUse.has(m.id))
  const mb = (list: typeof media) => (list.reduce((a, m) => a + (m.filesize ?? 0), 0) / 1e6).toFixed(0)
  console.log(`Files starting "${PREFIX}": ${media.length}`)
  console.log(`  still shown by an item (kept): ${blocked.length}${blocked.length ? ` — ${[...new Set(blocked.map((m) => inUse.get(m.id)))].join(', ')}` : ''}`)
  console.log(`  not shown by any item: ${free.length} (${mb(free)} MB)`)
  if (!CONFIRM) {
    console.log('Report only. Set CONFIRM=yes to delete the files not shown by any item.')
    process.exit(0)
  }
  let n = 0
  for (const m of free) {
    await payload.delete({ collection: 'media', id: m.id, overrideAccess: true })
    if (++n % 50 === 0) console.log(`  ${n} deleted…`)
  }
  console.log(`Deleted ${n} files.`)
  process.exit(0)
}

// Awaited at the top level: `payload run` exits once this module has loaded.
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
