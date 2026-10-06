/**
 * Import the metadata pipeline's output into the CMS.
 *
 *   pnpm import:pipeline              # write
 *   DRY_RUN=1 pnpm import:pipeline    # report only, touches nothing
 *
 * Reads <PIPELINE_DIR>/out_batch/*.loc15.json and the scans in <PIPELINE_DIR>/images.
 * PIPELINE_DIR defaults to ../daaho-metadata-pipeline.
 *
 * Create-only by design: anything that already exists — an item, a person, a scan, a term — is left
 * exactly as it is, so re-running never overwrites work an editor has done in the CMS. To re-import
 * one item from scratch, delete it in the CMS and run again.
 *
 * Run it locally, against whichever database DATABASE_URL points to. Do not run it as a serverless
 * function: uploading 316 scans takes minutes.
 */
import fs from 'node:fs'
import path from 'node:path'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { asList } from '@/lib/fields'
import { cleanName, clusters, mayBeSamePerson, splitJoined, type NameKind } from '@/lib/names'
import { detectRegions } from '@/lib/regions'
import { slugify } from '@/lib/slug'


/** Where this run will write, without credentials — printed before anything is written. */
function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

const PIPELINE_DIR = path.resolve(process.env.PIPELINE_DIR ?? '../daaho-metadata-pipeline')
const DRY_RUN = !!process.env.DRY_RUN
const LOW_CONFIDENCE = 70

type Meta = Record<string, unknown> & { field_confidence?: Record<string, number | null> }
type Record_ = {
  metadata: Meta
  context: {
    item_id: string
    model?: string
    prompt_version?: string
    pages: { filename: string; label?: string }[]
    // Names the pipeline removed because they were not exactly one name (its decision D-014).
    rejected_names?: Record<string, { value: string; reason: string; suggested_split?: string[] }[]>
  }
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function loadRecords(): Record_[] {
  const dir = path.join(PIPELINE_DIR, 'out_batch')
  if (!fs.existsSync(dir)) throw new Error(`No pipeline output at ${dir}. Set PIPELINE_DIR.`)
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.loc15.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record_)
}

/** "correspondence  # aat:300026877" -> correspondence => http://vocab.getty.edu/aat/300026877 */
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

type NameEntry = { key: string; display: string; kind: NameKind; uncertain: boolean; aliases: Set<string> }
type Role = 'creator' | 'correspondent' | 'contributor'
const ROLE_RANK: Record<Role, number> = { creator: 0, correspondent: 1, contributor: 2 }

/** Pass 1, pure: resolve every name string in the batch before writing anything. */
function resolveNames(records: Record_[]) {
  const names = new Map<string, NameEntry>()
  const perItem = new Map<string, { key: string; role: Role }[]>()
  const issues = new Map<string, string[]>()

  for (const r of records) {
    const id = r.context.item_id
    const links: { key: string; role: Role }[] = []
    const fields: [Role, unknown][] = [
      ['creator', r.metadata.creator],
      ['correspondent', r.metadata.correspondents],
      ['contributor', r.metadata.contributors],
    ]
    for (const [role, value] of fields) {
      for (const raw of asList(value).flatMap(splitJoined)) {
        const c = cleanName(raw)
        if (!c.ok) {
          ;(issues.get(id) ?? issues.set(id, []).get(id)!).push(`Name not imported (${c.reason}): "${raw}"`)
          continue
        }
        const entry = names.get(c.key) ?? { key: c.key, display: c.display, kind: c.kind, uncertain: false, aliases: new Set() }
        entry.aliases.add(raw)
        entry.uncertain ||= c.uncertain
        // Prefer the inverted, most complete spelling as the display name.
        const score = (s: string) => (s.includes(',') ? 1000 : 0) + s.length
        if (score(c.display) > score(entry.display)) entry.display = c.display
        names.set(c.key, entry)
        links.push({ key: c.key, role })
        if (c.uncertain) {
          ;(issues.get(id) ?? issues.set(id, []).get(id)!).push(`Uncertain reading of a name: "${raw}"`)
        }
      }
    }
    // One row per person per item; a letter's writer is its creator first, correspondent second.
    const best = new Map<string, Role>()
    for (const l of links) {
      const cur = best.get(l.key)
      if (!cur || ROLE_RANK[l.role] < ROLE_RANK[cur]) best.set(l.key, l.role)
    }
    perItem.set(id, [...best].map(([key, role]) => ({ key, role })))

    // The pipeline has already removed these from the data and recorded them only in its own notes.
    // Carry them into the CMS, or an editor would never learn the item is missing a name. A suggested
    // split is shown, not applied: the pipeline leaves that to a person, and so does this importer.
    for (const [field, rejected] of Object.entries(r.context.rejected_names ?? {})) {
      for (const { value, reason, suggested_split } of rejected) {
        const split = suggested_split?.length ? ` Suggested split: ${suggested_split.join(' | ')}` : ''
        ;(issues.get(id) ?? issues.set(id, []).get(id)!).push(
          `Pipeline removed a ${field} value (${reason}): "${value}".${split}`,
        )
      }
    }
  }

  const people = [...names.values()].filter((n) => n.kind === 'person')
  const duplicates = new Map<string, Set<string>>()
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      if (mayBeSamePerson(people[i].key, people[j].key)) {
        ;(duplicates.get(people[i].key) ?? duplicates.set(people[i].key, new Set()).get(people[i].key)!).add(people[j].key)
        ;(duplicates.get(people[j].key) ?? duplicates.set(people[j].key, new Set()).get(people[j].key)!).add(people[i].key)
      }
    }
  }
  return { names, perItem, issues, duplicates }
}

async function findOne(payload: Payload, collection: 'people' | 'places' | 'subjects' | 'genres' | 'media' | 'items', field: string, value: string) {
  const res = await payload.find({ collection, where: { [field]: { equals: value } }, limit: 1, depth: 0, draft: true, overrideAccess: true })
  return res.docs[0] as { id: number } | undefined
}

async function main() {
  const records = loadRecords()
  const aat = loadAatUris()
  const { names, perItem, issues, duplicates } = resolveNames(records)

  const kinds = [...names.values()].reduce<Record<string, number>>((a, n) => ((a[n.kind] = (a[n.kind] ?? 0) + 1), a), {})
  const rawCount = new Set([...names.values()].flatMap((n) => [...n.aliases])).size
  const rejected = [...issues.values()].flat().filter((s) => s.startsWith('Name not imported')).length
  console.log(`Database: ${describeDatabase()}`)
  console.log(`Pipeline: ${PIPELINE_DIR}`)
  console.log(`Records: ${records.length}, pages: ${records.reduce((a, r) => a + r.context.pages.length, 0)}`)
  console.log(`Name strings: ${rawCount} -> ${names.size} entries (${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')})`)
  console.log(`  merged automatically (provably the same name): ${rawCount - names.size}`)
  const groups = clusters(duplicates)
  console.log(
    `  possible-duplicate clusters for an editor to decide: ${groups.length} (covering ${duplicates.size} names)`,
  )
  console.log(`  strings not imported, reported on their item: ${rejected}`)
  console.log(`Items with import issues: ${issues.size}`)
  if (DRY_RUN) {
    for (const [id, list] of issues) for (const s of list) console.log(`  ${id}: ${s}`)
    console.log('\nPossible-duplicate clusters:')
    for (const g of groups.sort((a, b) => b.length - a.length)) {
      console.log(`  ${g.map((k) => names.get(k)!.display).join('  |  ')}`)
    }
    console.log('\nDRY_RUN set: nothing written.')
    return
  }

  const payload = await getPayload({ config })

  // In production mode the schema comes only from migrations, run by a deploy. A database with none
  // applied is not the one the site uses — typically a development branch copied from the Vercel
  // dashboard instead of the Production variables. Refuse rather than fail halfway on missing tables.
  if (process.env.NODE_ENV === 'production') {
    const applied = await payload
      .find({ collection: 'payload-migrations', limit: 0, overrideAccess: true })
      .then((r) => r.totalDocs)
      .catch(() => 0)
    if (!applied) {
      console.error(
        '\nThis database has no migrations applied, so it is not the database your deployment uses.\n' +
          'Put the Production DATABASE_URL in .env.production.local (Vercel -> Settings -> Environment Variables,\n' +
          'Production; or `npx vercel env pull .env.production.local --environment=production`) and run again.\n',
      )
      process.exit(1)
    }
  }

  const counts = { items: 0, itemsSkipped: 0, media: 0, people: 0, terms: 0 }

  const termIds = new Map<string, number>()
  async function term(collection: 'places' | 'subjects' | 'genres', name: string, authorityUri?: string) {
    const k = `${collection}:${name.toLowerCase()}`
    if (termIds.has(k)) return termIds.get(k)!
    let doc = await findOne(payload, collection, 'name', name)
    if (!doc) {
      doc = await payload.create({ collection, data: { name, authorityUri: authorityUri ?? null }, overrideAccess: true })
      counts.terms++
    }
    termIds.set(k, doc.id)
    return doc.id
  }

  // People: create all, then link possible duplicates (needs both ids).
  const personIds = new Map<string, number>()
  const created = new Set<string>()
  const usedSlugs = new Set<string>()
  for (const n of [...names.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    // A name an editor merged into another record maps to the survivor; recreating it would undo
    // the merge on every re-import.
    let doc =
      (await findOne(payload, 'people', 'importKey', n.key)) ??
      (await findOne(payload, 'people', 'mergedFrom.importKey', n.key))
    if (!doc) {
      let slug = slugify(n.display) || 'unnamed'
      for (let i = 2; usedSlugs.has(slug) || (await findOne(payload, 'people', 'slug', slug)); i++) slug = `${slugify(n.display)}-${i}`
      doc = await payload.create({
        collection: 'people',
        data: {
          name: n.display,
          slug,
          kind: n.kind,
          importKey: n.key,
          needsReview: n.uncertain,
          aliases: [...n.aliases].map((value) => ({ value })),
          _status: 'published', // a name alone is not editorial content; bios go through review
        },
        overrideAccess: true,
      })
      usedSlugs.add(slug)
      created.add(n.key)
      counts.people++
    }
    personIds.set(n.key, doc.id)
  }
  for (const [key, others] of duplicates) {
    if (!created.has(key)) continue
    await payload.update({
      collection: 'people',
      id: personIds.get(key)!,
      data: { possibleDuplicates: [...others].map((k) => personIds.get(k)!).filter(Boolean) },
      overrideAccess: true,
    })
  }

  for (const r of records) {
    const m = r.metadata
    const id = r.context.item_id
    if (await findOne(payload, 'items', 'itemId', id)) {
      counts.itemsSkipped++
      continue
    }
    const title = text(m.title) ?? id

    const pages = []
    for (const [i, p] of r.context.pages.entries()) {
      let media = await findOne(payload, 'media', 'sourceFilename', p.filename)
      if (!media) {
        const filePath = path.join(PIPELINE_DIR, 'images', p.filename)
        if (!fs.existsSync(filePath)) throw new Error(`${id}: scan missing: ${filePath}`)
        const label = p.label?.replace(/_/g, ' ')
        media = await payload.create({
          collection: 'media',
          data: { alt: `Page ${i + 1}${label ? ` (${label})` : ''} of "${title}"`, sourceFilename: p.filename, public: false },
          filePath,
          overrideAccess: true,
        })
        counts.media++
      }
      pages.push({ image: media.id, label: p.label?.replace(/_/g, ' ') ?? null })
    }

    const fc = m.field_confidence ?? {}
    const transcriptConfidence = typeof fc.transcript === 'number' ? fc.transcript : null
    await payload.create({
      collection: 'items',
      draft: true,
      data: {
        itemId: id,
        title,
        date: text(m.date),
        description: text(m.description),
        transcript: text(m.transcript),
        language: asList(m.language).join('; ') || null,
        regions: detectRegions({
          title,
          description: text(m.description),
          places: asList(m.place),
          subjects: asList(m.subjects),
          language: asList(m.language).join('; '),
        }),
        rights: text(m.rights),
        pages,
        people: (perItem.get(id) ?? []).map(({ key, role }) => ({ person: personIds.get(key)!, role })),
        places: await Promise.all(asList(m.place).map((n) => term('places', n))),
        subjects: await Promise.all(asList(m.subjects).map((n) => term('subjects', n))),
        genres: await Promise.all(asList(m.genre).map((n) => term('genres', n, aat.get(n.toLowerCase())))),
        archival: {
          repository: text(m.repository),
          collection: text(m.collection),
          series: text(m.series),
          box: text(m.box),
          folder: text(m.folder),
          callNumber: text(m.call_number),
        },
        review: { status: 'ai_generated' },
        ai: {
          model: r.context.model ?? null,
          promptVersion: r.context.prompt_version ?? null,
          transcriptConfidence,
          lowConfidence: transcriptConfidence != null && transcriptConfidence < LOW_CONFIDENCE,
          fieldConfidence: fc,
        },
        importIssues: (issues.get(id) ?? []).map((issue) => ({ issue })),
        _status: 'draft',
      },
      overrideAccess: true,
    })
    counts.items++
    if (counts.items % 10 === 0) console.log(`  ${counts.items} items imported...`)
  }

  console.log(
    `\nDone. Created ${counts.items} items (${counts.itemsSkipped} already present, skipped), ` +
      `${counts.media} scans, ${counts.people} people/organizations, ${counts.terms} places/subjects/genres.`,
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
