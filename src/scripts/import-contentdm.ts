/**
 * Add items held in another institution's CONTENTdm collection as linked records: the catalog record
 * and transcript are fetched from their site and kept here with our own links; the recording or scans
 * stay with them, and the item page links there. Nothing is downloaded but text.
 *
 *   pnpm import:contentdm                    local database
 *   DRY_RUN=1 pnpm import:contentdm          fetch and list what would be created, change nothing
 *   pnpm import:contentdm:production         the live database
 *
 * Reads the list in data/catalog/cml-oral-histories.json (LIST= for another). For each entry it takes
 * from the holder's record: title, date, description, subjects, rights, language and transcript. The
 * entry supplies what is ours: the item ID, the format, and the people (with their roles) and places,
 * read from the holder's description.
 *
 * The title, date and description are the holder's cataloguers', so they are marked checked and
 * written by people. The links are ours and the transcript is not checked against the recording: both
 * wait for staff. Created as drafts. Create-only: an item already there is left as it is.
 */
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '@payload-config'
import { nameKey } from '@/lib/names'
import { detectRegions } from '@/lib/regions'
import { slugify } from '@/lib/slug'
import type { Item, Person } from '@/payload-types'

const LIST = path.resolve(process.env.LIST ?? 'data/catalog/cml-oral-histories.json')
const DRY_RUN = !!process.env.DRY_RUN
const LANGUAGES: Record<string, string> = { eng: 'English', spa: 'Spanish', chi: 'Chinese', jpn: 'Japanese', kor: 'Korean', vie: 'Vietnamese' }

type Role = NonNullable<Item['people']>[number]['role']
type Entry = { url: string; itemId: string; format: NonNullable<Item['format']>; people: { name: string; role: Role }[]; places: string[] }
type List = { holder: string; addedOn: string; items: Entry[] }

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

// CONTENTdm returns an empty field as {}, not "".
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const list = (v: unknown) => (text(v) ?? '').split(';').map((s) => s.trim()).filter(Boolean)

async function getJson(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

/** ".../digital/collection/oralhistory/id/37/rec/4" → the record's own address, its API, its collection. */
function parseUrl(raw: string) {
  const u = new URL(raw)
  const m = /\/digital\/collection\/([^/]+)\/id\/(\d+)/.exec(u.pathname)
  if (!m) throw new Error(`Not a CONTENTdm item address: ${raw}`)
  const [, alias, id] = m
  const api = (q: string) => `${u.origin}/digital/bl/dmwebservices/index.php?q=${q}/json`
  // "/rec/4" is only the record's place in someone's search results.
  return { canonical: `${u.origin}/digital/collection/${alias}/id/${id}`, alias, record: api(`dmGetItemInfo/${alias}/${id}`), collections: api('dmGetCollectionList') }
}

/** The last "00:15:11" mark in a timed transcript, as "About 15 minutes". */
function duration(transcript: string | null): string | null {
  const marks = [...(transcript ?? '').matchAll(/^(\d{2}):(\d{2}):(\d{2})$/gm)]
  if (!marks.length) return null
  const [, h, m, s] = marks[marks.length - 1]
  const minutes = Math.round(Number(h) * 60 + Number(m) + Number(s) / 60)
  return minutes ? `About ${minutes} minutes` : null
}

async function main() {
  const { holder, addedOn, items } = JSON.parse(fs.readFileSync(LIST, 'utf8')) as List
  console.log(`Target database: ${describeDatabase()}${DRY_RUN ? '  [dry run: nothing is written]' : ''}`)
  const payload = await getPayload({ config })
  if (process.env.NODE_ENV === 'production') {
    const applied = await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0)
    if (!applied) {
      console.error('\nThis database has no migrations applied, so it is not the database your deployment uses. Stopping.\n')
      process.exit(1)
    }
  }

  const report = { created: [] as string[], skipped: [] as string[], newPeople: [] as string[], newTerms: [] as string[] }

  // People: by any spelling that is provably the same name, else new; as in import-phase1.
  const people = (await payload.find({ collection: 'people', pagination: false, depth: 0, draft: true, overrideAccess: true })).docs as Person[]
  const byKey = new Map<string, Person>()
  for (const p of people) {
    for (const k of [p.importKey, nameKey(p.name), ...(p.aliases ?? []).map((a) => nameKey(a.value)), ...(p.mergedFrom ?? []).map((m) => m.importKey)]) {
      if (k && !byKey.has(k)) byKey.set(k, p)
    }
  }
  const added = new Map<string, number>()
  async function person(name: string): Promise<number> {
    const found = byKey.get(nameKey(name))?.id ?? added.get(nameKey(name))
    if (found !== undefined) return found
    const kind = name.includes(',') ? 'person' : 'organization'
    report.newPeople.push(`${name} (${kind})`)
    if (DRY_RUN) {
      added.set(nameKey(name), -1)
      return -1
    }
    let slug = slugify(name) || 'unnamed'
    for (let i = 2; (await payload.find({ collection: 'people', where: { slug: { equals: slug } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs.length; i++) slug = `${slugify(name)}-${i}`
    const doc = (await payload.create({
      collection: 'people',
      data: { name, slug, kind, importKey: nameKey(name), aliases: [{ value: name }], _status: 'published' },
      overrideAccess: true,
    })) as Person
    added.set(nameKey(name), doc.id)
    return doc.id
  }

  // Places and subjects: the existing heading, whatever its capitals, else a new one.
  const terms = {} as Record<'places' | 'subjects', Map<string, number>>
  for (const c of ['places', 'subjects'] as const) {
    const docs = (await payload.find({ collection: c, pagination: false, depth: 0, overrideAccess: true })).docs
    terms[c] = new Map(docs.map((t) => [t.name.toLowerCase(), t.id]))
  }
  async function term(c: 'places' | 'subjects', name: string): Promise<number> {
    const found = terms[c].get(name.toLowerCase())
    if (found) return found
    report.newTerms.push(`${c}: ${name}`)
    const id = DRY_RUN ? -1 : (await payload.create({ collection: c, data: { name }, overrideAccess: true })).id
    terms[c].set(name.toLowerCase(), id)
    return id
  }

  const collectionNames = new Map<string, Map<string, string>>()
  for (const entry of items) {
    if ((await payload.find({ collection: 'items', where: { itemId: { equals: entry.itemId } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs.length) {
      report.skipped.push(entry.itemId)
      continue
    }
    const { canonical, alias, record, collections } = parseUrl(entry.url)
    const rec = (await getJson(record)) as Record<string, unknown>
    if (!text(rec.title)) throw new Error(`${entry.url}: no record (${JSON.stringify(rec).slice(0, 200)})`)
    if (!collectionNames.has(collections)) {
      const all = (await getJson(collections)) as { alias: string; name: string }[]
      collectionNames.set(collections, new Map(all.map((c) => [c.alias.replace(/^\//, ''), c.name])))
    }

    const title = text(rec.title)!
    const description = text(rec.descri)
    const transcript = text(rec.text)
    const date = /^\d{4}(-\d{2}(-\d{2})?)?$/.test(text(rec.search) ?? '') ? text(rec.search) : null
    const subjects = list(rec.subjec)
    const language = text(rec.langua)
    const rights = [text(rec.righta), text(rec.rights) && `(${text(rec.rights)})`].filter(Boolean).join(' ')

    const links = []
    for (const p of entry.people) links.push({ person: await person(p.name), role: p.role })
    const data: Partial<Item> = {
      itemId: entry.itemId,
      format: entry.format,
      title,
      date,
      description,
      transcript,
      language: language ? (LANGUAGES[language] ?? language) : null,
      rights: `${rights ? `${rights}. ` : ''}Courtesy of ${holder}.`,
      people: links,
      places: await Promise.all(entry.places.map((n) => term('places', n))),
      subjects: await Promise.all(subjects.map((n) => term('subjects', n))),
      regions: detectRegions({ title, description, places: entry.places, subjects, language }),
      archival: {
        creator: text(rec.creato),
        type: text(rec.dcmi),
        extent: duration(transcript),
        repository: holder,
        collection: collectionNames.get(collections)!.get(alias) ?? null,
        url: canonical,
      },
      review: {
        titleChecked: true,
        ...(description ? { descriptionChecked: true } : {}),
        byPeople: ['title', ...(description ? (['description'] as const) : [])],
        notes:
          `Linked record added on ${addedOn} from ${holder}'s catalog (${canonical}, identifier ${text(rec.identi) ?? 'none'}). ` +
          `The title, date, description, subjects, rights and transcript are theirs; we keep no copy of the recording. ` +
          `The people, places and regions were added by us from their description: check them, add any others, then tick ` +
          `"People, places and subjects checked". The transcript has not been checked against the recording.`,
      },
      _status: 'draft',
    }
    report.created.push(`${entry.itemId}: ${title} (${data.archival!.extent ?? 'no duration'}; regions: ${data.regions!.join(', ') || 'none'})`)
    if (DRY_RUN) continue
    await payload.create({ collection: 'items', draft: true, data: data as Item, overrideAccess: true })
  }

  console.log(
    `\n${DRY_RUN ? 'Would create' : 'Created'}:\n${report.created.map((s) => `  ${s}`).join('\n') || '  none'}\n` +
      `Already there, left as they are: ${report.skipped.join(', ') || 'none'}\n` +
      `New people and organizations: ${report.newPeople.join(', ') || 'none'}\n` +
      `New headings: ${report.newTerms.join(', ') || 'none'}`,
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
