/**
 * Import the Asian Festival (Columbus) program booklets as draft items, scans only: one item per
 * year, AF-1996, AF-1997, ... No AI is run on them. The title and date come from the folder name,
 * and everything else is left for staff to fill in the admin.
 *
 *   pnpm import:asianfest                    local database
 *   DRY_RUN=1 pnpm import:asianfest          list what would be imported, change nothing
 *   ONLY=1997 pnpm import:asianfest          just these years (comma-separated)
 *   pnpm import:asianfest:production         the live database and bucket
 *
 * Reads <SCANS_DIR>/AsianFest <year> JPG/AsianFest_<year>_<NN>.jpg. SCANS_DIR defaults to
 * data/AsianFest JPG. Empty year folders are reported and skipped.
 *
 * Create-only, like import-pipeline: an item that already exists is left as it is, and a scan
 * already uploaded (matched by its filename) is reused, so a run that stops halfway can be repeated.
 */
import fs from 'fs'
import path from 'path'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'

const DIR = path.resolve(process.env.SCANS_DIR ?? 'data/AsianFest JPG')
const DRY_RUN = !!process.env.DRY_RUN
const ONLY = new Set((process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean))
const FOLDER = /^AsianFest (\d{4}) JPG$/
const SCAN = /^AsianFest_(\d{4})_(\d+)([a-z]?)\.jpg$/i

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

type Scan = { file: string; number: number; suffix: string }
type Booklet = { year: string; id: string; scans: Scan[]; issues: string[] }

function loadBooklets(): { booklets: Booklet[]; empty: string[] } {
  if (!fs.existsSync(DIR)) throw new Error(`No scans at ${DIR}. Set SCANS_DIR.`)
  const booklets: Booklet[] = []
  const empty: string[] = []
  for (const folder of fs.readdirSync(DIR).sort()) {
    const year = FOLDER.exec(folder)?.[1]
    if (!year) continue
    if (ONLY.size && !ONLY.has(year)) continue
    const files = fs.readdirSync(path.join(DIR, folder)).filter((f) => !f.startsWith('.'))
    if (!files.length) {
      empty.push(year)
      continue
    }
    const scans = files.map((file) => {
      const m = SCAN.exec(file)
      if (!m || m[1] !== year) throw new Error(`${folder}: unexpected file "${file}"`)
      return { file, number: Number(m[2]), suffix: m[3].toLowerCase() }
    })
    scans.sort((a, b) => a.number - b.number || a.suffix.localeCompare(b.suffix))

    const issues: string[] = []
    const first = scans[0].number
    const last = scans[scans.length - 1].number
    if (first !== 1) issues.push(`Only scans ${first}–${last} of this booklet were supplied; the earlier pages are not in the folder.`)
    const missing = Array.from({ length: last - first + 1 }, (_, i) => first + i).filter((n) => !scans.some((s) => s.number === n))
    if (missing.length) issues.push(`Scan numbers missing from the folder: ${missing.join(', ')}.`)
    const suffixed = scans.filter((s) => s.suffix).map((s) => s.file)
    if (suffixed.length) issues.push(`What does the letter in ${suffixed.join(', ')} mean? Check these pages against the booklet.`)
    booklets.push({ year, id: `AF-${year}`, scans, issues })
  }
  return { booklets, empty }
}

async function findOne(payload: Payload, collection: 'media' | 'items', field: string, value: string) {
  const res = await payload.find({ collection, where: { [field]: { equals: value } }, limit: 1, depth: 0, draft: true, overrideAccess: true })
  return res.docs[0] as { id: number } | undefined
}

async function main() {
  const { booklets, empty } = loadBooklets()
  console.log(`Target database: ${describeDatabase()}${DRY_RUN ? '  [dry run: nothing is written]' : ''}`)
  console.log(`Scans: ${DIR}`)
  console.log(`Booklets: ${booklets.length}, scans: ${booklets.reduce((a, b) => a + b.scans.length, 0)}`)
  if (empty.length) console.log(`Empty year folders, skipped: ${empty.join(', ')}`)
  for (const b of booklets) {
    console.log(`  ${b.id}: ${b.scans.length} scans`)
    for (const issue of b.issues) console.log(`    ${issue}`)
  }
  const payload = await getPayload({ config })
  if (process.env.NODE_ENV === 'production') {
    const applied = await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0)
    if (!applied) {
      console.error('\nThis database has no migrations applied, so it is not the database your deployment uses. Stopping.\n')
      process.exit(1)
    }
  }

  const counts = { items: 0, itemsSkipped: 0, media: 0 }
  for (const b of booklets) {
    if (await findOne(payload, 'items', 'itemId', b.id)) {
      console.log(`  ${b.id}: already exists, left as it is`)
      counts.itemsSkipped++
      continue
    }
    if (DRY_RUN) {
      console.log(`  ${b.id}: would be created`)
      counts.items++
      continue
    }
    const title = `AsianFest ${b.year}`
    const pages = []
    for (const [i, s] of b.scans.entries()) {
      let media = await findOne(payload, 'media', 'sourceFilename', s.file)
      if (!media) {
        media = await payload.create({
          collection: 'media',
          data: { alt: `Page ${i + 1} of "${title}"`, sourceFilename: s.file, public: false },
          filePath: path.join(DIR, `AsianFest ${b.year} JPG`, s.file),
          overrideAccess: true,
        })
        counts.media++
      }
      // Label a page only where its scan number is not its position, so staff can match it to the folder.
      const label = s.number !== i + 1 || s.suffix ? `Scan ${s.number}${s.suffix}` : null
      pages.push({ image: media.id, label })
    }
    await payload.create({
      collection: 'items',
      draft: true,
      data: {
        itemId: b.id,
        title,
        date: b.year,
        pages,
        review: {
          notes:
            'Scans imported from the AsianFest JPG folder (Google Drive) on 2026-10-30, with no AI processing. ' +
            'The title and date come from the folder name; check them against the cover. ' +
            'The rights and source of the booklets are not yet recorded: do not publish until they are.',
        },
        importIssues: b.issues.map((issue) => ({ issue })),
        _status: 'draft',
      },
      overrideAccess: true,
    })
    counts.items++
    console.log(`  ${b.id}: imported, ${pages.length} pages`)
  }

  console.log(
    DRY_RUN
      ? `\nDRY_RUN set: nothing written. ${counts.items} items would be created, ${counts.itemsSkipped} already there.`
      : `\nDone: ${counts.items} items created, ${counts.itemsSkipped} already there, ${counts.media} scans uploaded.`,
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
