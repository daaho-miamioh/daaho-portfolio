/**
 * Export every item as the editors see it (latest version, drafts included), with its people,
 * places, subjects and genres by name, for checks that run outside the site such as the
 * metadata pipeline's MAP audit (scripts/map_audit.py there).
 *
 *   pnpm export:items                       # local database → ./items-export.json
 *   pnpm export:items:production            # the live site, read only
 *   OUT=/path/file.json pnpm export:items   # somewhere else
 *
 * Read only: it never writes to the database.
 */
import fs from 'node:fs'
import path from 'node:path'

import config from '@payload-config'
import { getPayload } from 'payload'

import type { Item } from '@/payload-types'

const OUT = path.resolve(process.env.OUT ?? 'items-export.json')

const named = (v: unknown) => (v && typeof v === 'object' && 'name' in v ? String((v as { name: unknown }).name) : null)

async function main() {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'items', draft: true, depth: 1, pagination: false, overrideAccess: true })
  const items = (docs as Item[]).map((it) => ({
    id: it.id,
    itemId: it.itemId,
    slug: it.slug,
    status: it._status,
    format: it.format,
    set: typeof it.set === 'object' && it.set ? it.set.slug : null,
    title: it.title,
    date: it.date ?? null,
    description: it.description ?? null,
    rights: it.rights ?? null,
    language: it.language ?? null,
    archival: it.archival ?? {},
    pageCount: (it.pages ?? []).length,
    hasRecording: !!it.recording,
    transcript: it.transcript ?? null,
    people: (it.people ?? []).map((p) => ({
      name: named(p.person),
      kind: p.person && typeof p.person === 'object' ? (p.person.kind ?? null) : null,
      role: p.role,
    })),
    places: (it.places ?? []).map(named),
    subjects: (it.subjects ?? []).map(named),
    genres: (it.genres ?? []).map(named),
    review: it.review ?? {},
  }))
  fs.writeFileSync(OUT, JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 1))
  console.log(`${items.length} items → ${OUT}`)
  process.exit(0)
}

// Awaited at the top level: `payload run` exits once this module has loaded.
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
