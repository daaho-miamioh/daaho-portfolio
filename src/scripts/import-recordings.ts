/**
 * Import recordings from the metadata pipeline (its decision D-019) as draft items.
 *
 *   pnpm import:recordings                 # local database
 *   pnpm import:recordings:production      # the live site, from this machine
 *   DRY_RUN=1 pnpm import:recordings       # report only, touches nothing
 *
 * Reads <PIPELINE_DIR>/out_audio/<ID>/item.json and the listening copy beside it. PIPELINE_DIR
 * defaults to ../daaho-metadata-pipeline.
 *
 * - Every item is a draft. Nothing here publishes, and the listening copy stays private until an
 *   editor publishes the item.
 * - An item that does not exist is created. One that exists is refreshed from the pipeline only
 *   while it is still an unreviewed draft. Once anyone has published it or ticked one of its
 *   review checks, it is left exactly as it is, so a re-run never overwrites a person's work.
 * - The collection named in item.json is created as a draft from data/catalog/sets.json if the site
 *   does not have it.
 * - People the record names are listed in the item's staff notes for an editor to link, not
 *   created: a recording names few people, and each needs checking against the tape.
 *
 * Run it from this machine, never on the server: each listening copy is 30 MB or more, beyond what
 * a serverless request accepts.
 */
import fs from 'node:fs'
import path from 'node:path'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import type { Item } from '@/payload-types'

const PIPELINE_DIR = path.resolve(process.env.PIPELINE_DIR ?? '../daaho-metadata-pipeline')
const DRY_RUN = !!process.env.DRY_RUN

type Recording = {
  schema: string
  itemId: string
  format: 'audio' | 'oral_history' | 'video'
  set?: string | null
  title?: string | null
  date?: string | null
  description?: string | null
  language?: string | null
  places: string[]
  subjects: string[]
  genres: string[]
  people: { name: string; role?: string; source?: string }[]
  archival: { creator?: string | null; type?: string | null; extent?: string | null; collection?: string | null }
  label?: { lines?: string[] } | null
  transcript: string
  files: { listening: string; master?: string }
  ai: { model?: string; promptVersion?: string }
  review_notes: string[]
}

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

function loadRecordings(): { dir: string; rec: Recording }[] {
  const root = path.join(PIPELINE_DIR, 'out_audio')
  if (!fs.existsSync(root)) throw new Error(`No recordings at ${root}. Run the pipeline's app.audio_main first, or set PIPELINE_DIR.`)
  return fs
    .readdirSync(root)
    .map((name) => path.join(root, name))
    .filter((dir) => fs.existsSync(path.join(dir, 'item.json')))
    .map((dir) => ({ dir, rec: JSON.parse(fs.readFileSync(path.join(dir, 'item.json'), 'utf8')) as Recording }))
    .filter(({ rec }) => rec.schema === 'daaho-recording/1')
    .sort((a, b) => a.rec.itemId.localeCompare(b.rec.itemId))
}

function loadAatUris(): Map<string, string> {
  const file = path.join(PIPELINE_DIR, 'vocab', 'aat_genre.txt')
  const map = new Map<string, string>()
  if (!fs.existsSync(file)) return map
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([^#]+?)\s*#\s*aat:(\d+)/.exec(line)
    if (m) map.set(m[1].toLowerCase(), `http://vocab.getty.edu/aat/${m[2]}`)
  }
  return map
}

const reviewed = (item: Item) => {
  const r = item.review ?? {}
  return !!(r.titleChecked || r.descriptionChecked || r.transcriptChecked || r.linksChecked)
}

async function findOne(payload: Payload, collection: 'places' | 'subjects' | 'genres' | 'media', field: string, value: string) {
  return (await payload.find({ collection, where: { [field]: { equals: value } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as
    | { id: number }
    | undefined
}

async function main() {
  const recordings = loadRecordings()
  console.log(`Database: ${describeDatabase()}`)
  console.log(`Pipeline: ${PIPELINE_DIR}`)
  console.log(`Recordings: ${recordings.map((r) => r.rec.itemId).join(', ') || 'none'}`)
  for (const { dir, rec } of recordings) {
    const file = path.join(dir, rec.files.listening)
    if (!fs.existsSync(file)) throw new Error(`${rec.itemId}: listening copy missing at ${file}`)
  }
  if (DRY_RUN) {
    console.log('DRY_RUN set: nothing written.')
    return
  }

  const payload = await getPayload({ config })
  if (process.env.NODE_ENV === 'production') {
    // The schema comes only from migrations there; refuse a database the deployment does not use,
    // and one the recording migration has not reached yet.
    const migrations = await payload.find({ collection: 'payload-migrations', pagination: false, overrideAccess: true }).catch(() => null)
    const names = new Set((migrations?.docs ?? []).map((m) => (m as { name?: string }).name))
    if (!names.has('20261110_204753_item_recording')) {
      console.error('\nThis database does not have the item_recording migration yet. Deploy the site first (its build runs migrations), then run again.\n')
      process.exit(1)
    }
  }

  const aat = loadAatUris()
  const sets = JSON.parse(fs.readFileSync(path.resolve('data/catalog/sets.json'), 'utf8')).sets as Record<string, unknown>[]
  const counts = { created: 0, refreshed: 0, kept: 0, media: 0, terms: 0 }

  const termIds = new Map<string, number>()
  async function term(collection: 'places' | 'subjects' | 'genres', name: string) {
    const key = `${collection}:${name.toLowerCase()}`
    if (termIds.has(key)) return termIds.get(key)!
    let doc = await findOne(payload, collection, 'name', name)
    if (!doc) {
      const authorityUri = collection === 'genres' ? (aat.get(name.toLowerCase()) ?? null) : null
      doc = await payload.create({ collection, data: { name, authorityUri }, overrideAccess: true })
      counts.terms++
    }
    termIds.set(key, doc.id)
    return doc.id
  }

  async function setId(slug: string | null | undefined) {
    if (!slug) return null
    const found = (await payload.find({ collection: 'sets', where: { slug: { equals: slug } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs[0]
    if (found) return found.id
    const entry = sets.find((s) => s.slug === slug)
    if (!entry) {
      console.warn(`  collection "${slug}" is neither on the site nor in data/catalog/sets.json; items left without one`)
      return null
    }
    const { prefix: _prefix, ...data } = entry
    const created = await payload.create({ collection: 'sets', draft: true, data: { ...data, _status: 'draft' } as never, overrideAccess: true })
    console.log(`  created collection "${created.title}" as a draft`)
    return created.id
  }

  for (const { dir, rec } of recordings) {
    const existing = (await payload.find({ collection: 'items', where: { itemId: { equals: rec.itemId } }, limit: 1, depth: 0, draft: true, overrideAccess: true }))
      .docs[0] as Item | undefined
    if (existing && (existing._status === 'published' || reviewed(existing))) {
      counts.kept++
      console.log(`  ${rec.itemId}: published or partly reviewed; left as it is`)
      continue
    }

    // Reuse the copy the item already has: on upload Payload may have renamed it (…-1.mp3) to avoid a
    // file of the same name, so a lookup by the pipeline's filename alone would upload it again.
    const attached = typeof existing?.recording === 'number' ? { id: existing.recording } : undefined
    let media = attached ?? (await findOne(payload, 'media', 'filename', rec.files.listening))
    if (!media) {
      const data = fs.readFileSync(path.join(dir, rec.files.listening))
      media = await payload.create({
        collection: 'media',
        data: { alt: `Recording of ${rec.itemId}`, public: false, sourceFilename: rec.files.master ?? null },
        file: { data, mimetype: 'audio/mpeg', name: rec.files.listening, size: data.length },
        overrideAccess: true,
      })
      counts.media++
    }

    const people = rec.people.map((p) => `${p.name}${p.role ? ` (${p.role}` : ''}${p.source ? `, from the ${p.source}` : ''}${p.role ? ')' : ''}`)
    const notes = [
      ...rec.review_notes,
      ...(rec.label?.lines?.length ? [`Label as the AI read it (check against the photograph): ${rec.label.lines.join(' / ')}`] : []),
      ...(people.length ? [`People named, to link on the People tab once checked: ${people.join('; ')}`] : []),
    ]
    const data = {
      itemId: rec.itemId,
      title: rec.title || rec.itemId,
      date: rec.date ?? null,
      description: rec.description ?? null,
      format: rec.format,
      set: await setId(rec.set),
      recording: media.id,
      pages: [],
      transcript: rec.transcript,
      language: rec.language ?? null,
      places: await Promise.all(rec.places.map((n) => term('places', n))),
      subjects: await Promise.all(rec.subjects.map((n) => term('subjects', n))),
      genres: await Promise.all(rec.genres.map((n) => term('genres', n))),
      archival: {
        creator: rec.archival.creator ?? null,
        type: rec.archival.type ?? null,
        extent: rec.archival.extent ?? null,
        collection: rec.archival.collection ?? null,
      },
      ai: { model: rec.ai.model ?? null, promptVersion: rec.ai.promptVersion ?? null },
      review: { notes: notes.join('\n') },
      _status: 'draft' as const,
    }
    if (existing) {
      await payload.update({ collection: 'items', id: existing.id, draft: true, data, overrideAccess: true })
      counts.refreshed++
      console.log(`  ${rec.itemId}: refreshed (unreviewed draft)`)
    } else {
      await payload.create({ collection: 'items', draft: true, data, overrideAccess: true })
      counts.created++
      console.log(`  ${rec.itemId}: created as a draft`)
    }
  }
  console.log(
    `\nDone: ${counts.created} created, ${counts.refreshed} refreshed, ${counts.kept} left as they were; ` +
      `${counts.media} listening copies uploaded, ${counts.terms} places/subjects/genres added.`,
  )
  process.exit(0)
}

// Awaited at the top level: `payload run` exits once this module has loaded.
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
