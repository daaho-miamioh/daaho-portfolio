/**
 * Bring the project's biographies from Lived Experiences at Miami (LivedMU) into Stories, with their
 * portraits, sources and credits, linked to the documents in this collection.
 *
 *   pnpm import:stories                local database
 *   pnpm import:stories:production     the live database
 *
 * Reads data/stories/livedmu.json (exported from LivedMU's public dataset) and
 * data/stories/documents.json (which items each story draws on). Portraits are downloaded from
 * LivedMU's image server into the media library. Create-only: a story whose slug already exists is
 * left alone, so edits made in the CMS are never overwritten. Stories are published, as they are on
 * LivedMU, under its CC BY-NC-SA 4.0 licence, with the original credited and linked.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getPayload } from 'payload'

import config from '@payload-config'
import { markdownToLexical } from '@/lib/markdownToLexical'
import type { Item } from '@/payload-types'

type Education = { degree?: string | null; otherDegree?: string | null; graduationYear?: string | null; majors?: string[] | null }
type Exported = {
  slug: string
  title: string
  storyType: string
  decades?: string[]
  themes?: string[]
  publishedAt?: string
  body: string
  citations?: string
  credit?: string | null
  sourceUrl: string
  person?: {
    name: string
    bio?: string
    born?: string | null
    died?: string | null
    education?: Education[] | null
    portrait?: { url: string; originalFilename?: string } | null
  }
  selectedDocuments?: { contentdmTitle: string; contentdmManifest: string; description?: string }[] | null
}

const DATA = JSON.parse(fs.readFileSync(path.resolve('data/stories/livedmu.json'), 'utf8')) as {
  license: { name: string; url: string }
  stories: Exported[]
}
const DOCS = JSON.parse(fs.readFileSync(path.resolve('data/stories/documents.json'), 'utf8')).documents as Record<string, string[]>

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

const year = (d?: string | null) => (d ? d.slice(0, 4) : '')
const lifeDates = (p: Exported['person']) => (p && (p.born || p.died) ? `${year(p.born) || '?'}–${year(p.died) || ''}` : null)
const atMiami = (ed?: Education[] | null) =>
  (ed ?? [])
    .map((e) => [e.degree || e.otherDegree, (e.majors ?? []).join(' & '), year(e.graduationYear)].filter(Boolean).join(', '))
    .filter(Boolean)
    .join('; ') || null
/** "Written by Grace Farrell, (B.A., …)" reads better without the comma before the bracket. */
const cleanCredit = (c?: string | null) => (c ? c.replace(/,\s*\(/, ' (') : null)
const authorOf = (c?: string | null) => (c ? (/Written by ([^,(]+)/.exec(c)?.[1].trim() ?? null) : null)
/** The opening sentences, for the story list, when LivedMU has no short biography. */
function dekFrom(s: Exported) {
  if (s.person?.bio?.trim()) return s.person.bio.trim()
  const first = s.body.split(/\n\s*\n/)[0].replace(/\*/g, '')
  const sentences = first.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [first]
  return sentences.slice(0, 2).join('').trim()
}
/** A IIIF manifest address for a CONTENTdm item, as the item's page a reader can open. */
const contentdmPage = (manifest: string) => {
  const m = /\/iiif\/info\/([^/]+)\/(\d+)\/manifest\.json$/.exec(manifest)
  return m ? `https://digital.lib.miamioh.edu/digital/collection/${m[1]}/id/${m[2]}` : manifest
}

async function main() {
  console.log(`Target database: ${describeDatabase()}`)
  const payload = await getPayload({ config })
  if (process.env.NODE_ENV === 'production') {
    const applied = await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0)
    if (!applied) {
      console.error('\nThis database has no migrations applied, so it is not the database your deployment uses. Stopping.\n')
      process.exit(1)
    }
  }

  const items = (await payload.find({ collection: 'items', pagination: false, depth: 0, draft: true, select: { itemId: true }, overrideAccess: true })).docs as Pick<Item, 'id' | 'itemId'>[]
  const itemByCode = new Map(items.map((i) => [i.itemId, i.id]))
  const refs = new Map(
    (await payload.find({ collection: 'items', pagination: false, depth: 0, draft: true, select: { itemId: true, slug: true }, overrideAccess: true })).docs.map((i) => [i.itemId, `/items/${i.slug}`] as [string, string]),
  )
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'daaho-stories-'))
  let created = 0
  let skipped = 0

  for (const s of DATA.stories) {
    const exists = await payload.find({ collection: 'stories', where: { slug: { equals: s.slug } }, limit: 1, depth: 0, draft: true, overrideAccess: true })
    if (exists.docs[0]) {
      skipped++
      continue
    }

    let portrait: number | undefined
    const p = s.person?.portrait
    if (p?.url) {
      const key = `livedmu/${s.slug}/${p.originalFilename ?? path.basename(p.url)}`
      const found = await payload.find({ collection: 'media', where: { sourceFilename: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
      if (found.docs[0]) portrait = found.docs[0].id
      else {
        const res = await fetch(p.url)
        if (!res.ok) throw new Error(`${s.slug}: portrait download failed (${res.status})`)
        const file = path.join(tmp, `${s.slug}${path.extname(new URL(p.url).pathname) || '.jpg'}`)
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
        const media = await payload.create({
          collection: 'media',
          data: { alt: `Portrait of ${s.person!.name}`, sourceFilename: key, public: true },
          filePath: file,
          overrideAccess: true,
        })
        portrait = media.id
      }
    }

    const wanted = DOCS[s.slug] ?? []
    const missing = wanted.filter((code) => !itemByCode.has(code))
    if (missing.length) console.warn(`${s.slug}: not in the collection, skipped: ${missing.join(', ')}`)
    const author = authorOf(s.credit)

    await payload.create({
      collection: 'stories',
      overrideAccess: true,
      data: {
        title: s.title.trim(),
        slug: s.slug,
        storyType: /theme/i.test(s.storyType) ? 'theme' : 'biography',
        dek: dekFrom(s),
        body: markdownToLexical(s.body) as never,
        sources: s.citations ? (markdownToLexical(s.citations, refs) as never) : undefined,
        credit: cleanCredit(s.credit),
        authors: author ? [author] : [],
        subject: {
          name: s.person?.name ?? s.title.trim(),
          lifeDates: lifeDates(s.person),
          atMiami: atMiami(s.person?.education),
          portrait,
        },
        documents: wanted.map((code) => itemByCode.get(code)).filter((id): id is number => typeof id === 'number'),
        elsewhere: (s.selectedDocuments ?? []).map((d) => ({ title: d.contentdmTitle, url: contentdmPage(d.contentdmManifest), description: d.description })),
        decades: s.decades ?? [],
        themes: s.themes ?? [],
        publishedAt: s.publishedAt,
        origin: { site: 'Lived Experiences at Miami (LivedMU)', url: s.sourceUrl, license: DATA.license.name, licenseUrl: DATA.license.url },
        _status: 'published',
      },
    })
    created++
    console.log(`  ${s.title.trim()}: ${wanted.length - missing.length} documents${portrait ? ', portrait' : ''}`)
  }
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`Stories created: ${created}; already present: ${skipped}`)
  process.exit(0)
}

await main()
