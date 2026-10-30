/**
 * Apply the Phase 1 catalog records (data/catalog/phase1.csv, the BC- items) and make them public.
 * The cataloguers checked every field they filled, so the title and date, the description and the
 * links are all marked checked, and marked as written by people. The transcript is not: the catalog
 * has none.
 *
 *   pnpm import:phase1                    local database
 *   DRY_RUN=1 pnpm import:phase1          list what would change, change nothing
 *   pnpm import:phase1:production         the live database
 *
 * - Title and date replace the AI's, and Summary becomes the description. The AI's versions are kept
 *   under AI provenance for staff.
 * - Creator, Correspondents and Subject (People) replace the item's people; Location its places;
 *   Subject (FAST) and Subject (Local) its subjects; Genre its genres. Links the AI made that the
 *   catalog does not have go into the staff note, so an editor can add back any that are right.
 * - Names are matched to people on the site through data/catalog/phase1-names.json where the
 *   spelling differs; a name that matches nobody becomes a new record.
 * - A date range or a list of years is stored as its first date; the title keeps the full span.
 *
 * Safe to run again: it sets the same values, never overwrites a saved AI original, and adds the
 * staff note once.
 */
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '@payload-config'
import { parseCsv } from '@/lib/csv'
import { nameKey } from '@/lib/names'
import { slugify } from '@/lib/slug'
import type { Item, Person } from '@/payload-types'

const CSV = path.resolve('data/catalog/phase1.csv')
const NAMES = path.resolve('data/catalog/phase1-names.json')
const DRY_RUN = !!process.env.DRY_RUN
const NOTE_MARK = 'Phase 1 catalog record applied'

type Names = {
  checkedOn: string
  corrections: Record<string, { to: string }>
  people: Record<string, { site: string }>
  subjects: Record<string, { to: string }>
}

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

const orNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null)
const list = (v: string | undefined) => (v ?? '').split(';').map((s) => s.trim()).filter(Boolean)
const idOf = (v: number | { id: number } | null | undefined) => (typeof v === 'object' ? v?.id : v)

/** "1937-11-17-1938-03-30" → "1937-11-17", "1950; 1951; 1952" → "1950": the date field holds one date. */
function firstDate(id: string, raw: string): string | null {
  if (!raw.trim()) return null
  const m = /^\d{4}(-\d{2}(-\d{2})?)?/.exec(raw.trim())
  if (!m) throw new Error(`${id}: unexpected date "${raw}" in the catalog`)
  return m[0]
}

/** "President, Alfred Horatio Upham, Office Files, 1940-41. Box 22" → the collection, and "Box 22". */
function splitBox(raw: string): { collection: string | null; box: string | null } {
  const m = /^(.*?)\.?\s+(Box\s+\S+)$/.exec(raw.trim())
  return m ? { collection: m[1], box: m[2] } : { collection: orNull(raw), box: null }
}

async function main() {
  console.log(`Target database: ${describeDatabase()}${DRY_RUN ? '  [dry run: nothing is written]' : ''}`)
  const payload = await getPayload({ config })
  if (process.env.NODE_ENV === 'production') {
    const applied = await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0)
    if (!applied) {
      console.error('\nThis database has no migrations applied, so it is not the database your deployment uses. Stopping.\n')
      process.exit(1)
    }
  }

  const rows = parseCsv(fs.readFileSync(CSV, 'utf8')).filter((r) => r.Identifier)
  const names = JSON.parse(fs.readFileSync(NAMES, 'utf8')) as Names
  const corrected = (v: string | undefined) => list(v).flatMap((n) => list(names.corrections[n]?.to ?? n))

  const report = { items: 0, missing: [] as string[], dates: [] as string[], newPeople: [] as string[], newTerms: [] as string[], aliases: [] as string[] }

  // People: by an explicit match, else by any spelling that is provably the same name, else new.
  const people = (await payload.find({ collection: 'people', pagination: false, depth: 0, draft: true, overrideAccess: true })).docs as Person[]
  const byKey = new Map<string, Person>()
  for (const p of people) {
    for (const k of [p.importKey, nameKey(p.name), ...(p.aliases ?? []).map((a) => nameKey(a.value)), ...(p.mergedFrom ?? []).map((m) => m.importKey)]) {
      if (k && !byKey.has(k)) byKey.set(k, p)
    }
  }
  const personFor = new Map<string, number>()
  async function person(name: string): Promise<number> {
    if (personFor.has(name)) return personFor.get(name)!
    const explicit = names.people[name]?.site
    let doc = explicit ? people.find((p) => p.name === explicit) : byKey.get(nameKey(name))
    if (explicit && !doc) throw new Error(`phase1-names.json: no person named "${explicit}" on the site`)
    if (doc) {
      if (!(doc.aliases ?? []).some((a) => a.value === name) && doc.name !== name) {
        report.aliases.push(`${doc.name} ← ${name}`)
        doc.aliases = [...(doc.aliases ?? []), { value: name }]
        if (!DRY_RUN) await payload.update({ collection: 'people', id: doc.id, data: { aliases: doc.aliases }, depth: 0, overrideAccess: true })
      }
    } else {
      // The catalog writes people inverted ("Choi, Rosa") and bodies without a comma.
      const kind = name.includes(',') ? 'person' : 'organization'
      report.newPeople.push(`${name} (${kind})`)
      if (DRY_RUN) {
        personFor.set(name, -1)
        return -1
      }
      let slug = slugify(name) || 'unnamed'
      for (let i = 2; (await payload.find({ collection: 'people', where: { slug: { equals: slug } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs.length; i++) slug = `${slugify(name)}-${i}`
      doc = (await payload.create({
        collection: 'people',
        data: { name, slug, kind, importKey: nameKey(name), aliases: [{ value: name }], _status: 'published' },
        overrideAccess: true,
      })) as Person
      people.push(doc)
      byKey.set(nameKey(name), doc)
    }
    personFor.set(name, doc.id)
    return doc.id
  }

  // Places, subjects and genres: the existing heading, whatever its capitals, else a new one.
  const terms = {} as Record<'places' | 'subjects' | 'genres', Map<string, { id: number; name: string }>>
  for (const c of ['places', 'subjects', 'genres'] as const) {
    const docs = (await payload.find({ collection: c, pagination: false, depth: 0, overrideAccess: true })).docs
    terms[c] = new Map(docs.map((t) => [t.name.toLowerCase(), { id: t.id, name: t.name }]))
  }
  async function term(c: 'places' | 'subjects' | 'genres', name: string): Promise<number> {
    const found = terms[c].get(name.toLowerCase())
    if (found) return found.id
    report.newTerms.push(`${c}: ${name}`)
    const id = DRY_RUN ? -1 : (await payload.create({ collection: c, data: { name }, overrideAccess: true })).id
    terms[c].set(name.toLowerCase(), { id, name })
    return id
  }

  for (const row of rows) {
    const id = row.Identifier.trim()
    const item = (await payload.find({ collection: 'items', where: { itemId: { equals: id } }, limit: 1, depth: 1, draft: true, overrideAccess: true })).docs[0] as Item | undefined
    if (!item) {
      report.missing.push(id)
      continue
    }

    // Each person once, in the most telling role: creator, then correspondent, then named.
    const links: { person: number; role: 'creator' | 'correspondent' | 'contributor' }[] = []
    for (const [cell, role] of [[row.Creator, 'creator'], [row.Correspondents, 'correspondent'], [row['Subject (People)'], 'contributor']] as const) {
      for (const n of corrected(cell)) {
        const pid = await person(n)
        if (!links.some((l) => l.person === pid && pid !== -1)) links.push({ person: pid, role })
      }
    }
    const places = await Promise.all(list(row.Location).map((n) => term('places', n)))
    const subjects: number[] = []
    for (const n of [...list(row['Subject (FAST)']), ...list(row['Subject (Local)'])]) {
      const tid = await term('subjects', names.subjects[n]?.to ?? n)
      if (!subjects.includes(tid) || tid === -1) subjects.push(tid)
    }
    const genres = await Promise.all(list(row.Genre).map((n) => term('genres', n)))

    // What the AI had linked that the catalog does not, for the staff note.
    const label = (v: number | { name: string }) => (typeof v === 'object' ? v.name : `#${v}`)
    const dropped = [
      ['people', (item.people ?? []).filter((r) => !links.some((l) => l.person === idOf(r.person))).map((r) => label(r.person))],
      ['places', (item.places ?? []).filter((p) => !places.includes(idOf(p)!)).map(label)],
      ['subjects', (item.subjects ?? []).filter((s) => !subjects.includes(idOf(s)!)).map(label)],
      ['genres', (item.genres ?? []).filter((g) => !genres.includes(idOf(g)!)).map(label)],
    ].filter(([, n]) => n.length) as [string, string[]][]

    const date = firstDate(id, row.Date)
    if (date !== (orNull(row.Date) ?? null)) report.dates.push(`${id}: "${row.Date || '(empty)'}" → ${date ?? 'undated'}`)
    const ai = { ...(item.ai ?? {}) }
    if (row.Title.trim() !== item.title && !ai.originalTitle) ai.originalTitle = item.title
    if ((date ?? '') !== (item.date ?? '') && !ai.originalDate && item.date) ai.originalDate = item.date
    const description = orNull(row.Summary)
    if (description && description !== item.description && !ai.originalDescription && item.description) ai.originalDescription = item.description

    const written: NonNullable<NonNullable<Item['review']>['byPeople']> = ['title', 'links', ...(description ? (['description'] as const) : [])]
    const review = {
      ...(item.review ?? {}),
      titleChecked: true,
      linksChecked: true,
      ...(description ? { descriptionChecked: true } : {}),
      // So the item page says these came from the catalog, not from AI.
      byPeople: [...new Set([...(item.review?.byPeople ?? []), ...written])],
    }
    if (!(review.notes ?? '').includes(NOTE_MARK)) {
      const note = [
        `${NOTE_MARK} on ${names.checkedOn}: title, date, description, catalog record and links are the cataloguers'.`,
        dropped.length && `Links the AI had made that the catalog does not, removed: ${dropped.map(([k, n]) => `${k}: ${n.join('; ')}`).join(' — ')}.`,
        orNull(row['Digitize Notes']) && `Digitization note: ${row['Digitize Notes'].trim()}`,
        orNull(row.Digitized) && `Digitized by ${row.Digitized.trim()}.`,
      ].filter(Boolean).join(' ')
      review.notes = [item.review?.notes, note].filter(Boolean).join('\n\n')
    }

    const { collection, box } = splitBox(row.Collection ?? '')
    const data: Partial<Item> = {
      title: row.Title.trim(),
      date,
      ...(description ? { description } : {}),
      rights: orNull(row.Rights) ?? item.rights,
      language: orNull(row.Language) ?? item.language,
      archival: {
        ...(item.archival ?? {}),
        // With the same corrections as the links, so the record and its links name people alike.
        creator: corrected(row.Creator).join('; ') || item.archival?.creator || null,
        type: orNull(row.Type) ?? item.archival?.type ?? null,
        theme: orNull(row.Theme) ?? item.archival?.theme ?? null,
        extent: orNull(row.Extent) ?? item.archival?.extent ?? null,
        dimensions: orNull(row.Dimensions) ?? item.archival?.dimensions ?? null,
        repository: orNull(row.Repository) ?? item.archival?.repository ?? null,
        collection: collection ?? item.archival?.collection ?? null,
        box: box ?? item.archival?.box ?? null,
        folder: orNull(row.Folder) ?? item.archival?.folder ?? null,
        digitalCollection: orNull(row['Digital Collection']) ?? item.archival?.digitalCollection ?? null,
      },
      people: links,
      places,
      subjects,
      genres,
      ai,
      review,
    }
    report.items++
    console.log(`\n${id}: ${row.Title.trim().slice(0, 90)}`)
    if (data.title !== item.title) console.log(`  title    AI: ${item.title.slice(0, 90)}`)
    if (dropped.length) console.log(`  removed  ${dropped.map(([k, n]) => `${k}: ${n.join('; ')}`).join(' | ')}`)
    if (DRY_RUN) continue
    await payload.update({
      collection: 'items',
      id: item.id,
      // Keep the item's own state: a draft stays a draft, a published item stays published.
      data: { ...data, _status: item._status } as Partial<Item>,
      draft: item._status !== 'published',
      depth: 0,
      overrideAccess: true,
    })
  }

  console.log(
    `\nItems given their catalog record: ${report.items}\n` +
      `Dates stored as their first date:\n${report.dates.map((d) => `  ${d}`).join('\n') || '  none'}\n` +
      `New people and organizations: ${report.newPeople.join(', ') || 'none'}\n` +
      `Catalog spellings added as aliases:\n${report.aliases.map((a) => `  ${a}`).join('\n') || '  none'}\n` +
      `New headings: ${report.newTerms.join(', ') || 'none'}\n` +
      `Catalog rows with no item on the site: ${report.missing.join(', ') || 'none'}`,
  )
  process.exit(0)
}

await main()
