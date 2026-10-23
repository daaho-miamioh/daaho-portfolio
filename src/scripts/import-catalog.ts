/**
 * Apply the library's catalog records, checked by people, to items, and the exhibit labels written
 * for the 2025 Mason Public Library exhibit as their descriptions.
 *
 *   pnpm import:catalog                    local database
 *   DRY_RUN=1 pnpm import:catalog          list what would change, change nothing
 *   pnpm import:catalog:production         the live database
 *
 * From data/catalog/aamu-phase2.csv (the AAEM metadata, Phase 2):
 *   - title and date replace the AI's, and the item is marked "Title and date checked". The AI's
 *     versions are kept under AI provenance for staff.
 *   - creator, type, theme, extent, dimensions, repository, collection, box, folder, shelf, digital
 *     collection, language and rights fill the catalog record.
 *   - AAMU-0073 is one catalog record for the five parts AAMU-0073a–e: they get its shared fields
 *     (where it is held, type, theme, rights, language), not its title, date, creator or extent.
 * From data/catalog/exhibit-labels.json: the label becomes the description, credited, and the item
 * is marked "Description checked"; the AI's description is kept for staff.
 *
 * Safe to run again: it sets the same values, and never overwrites a saved AI original.
 */
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '@payload-config'
import { parseCsv } from '@/lib/csv'
import type { Item } from '@/payload-types'

const CSV = path.resolve(process.env.CATALOG_CSV ?? 'data/catalog/aamu-phase2.csv')
const LABELS = path.resolve('data/catalog/exhibit-labels.json')
const DRY_RUN = !!process.env.DRY_RUN
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

const orNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null)

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
  const labels = JSON.parse(fs.readFileSync(LABELS, 'utf8')) as { credit: string; labels: { itemId: string; text: string }[] }
  const labelFor = new Map(labels.labels.map((l) => [l.itemId, l.text]))

  const { docs } = await payload.find({ collection: 'items', pagination: false, depth: 0, draft: true, overrideAccess: true })
  const items = docs as Item[]
  const byId = new Map(items.map((i) => [i.itemId, i]))

  const report = { titles: 0, dates: [] as string[], catalogOnly: 0, descriptions: 0, unchanged: 0, missing: [] as string[] }

  for (const row of rows) {
    const id = row.Identifier.trim()
    const parts = id === 'AAMU-0073' ? items.filter((i) => /^AAMU-0073[a-z]$/.test(i.itemId)) : [byId.get(id)].filter(Boolean) as Item[]
    if (!parts.length) {
      if (row.Title) report.missing.push(id)
      continue
    }
    for (const item of parts) {
      const exact = item.itemId === id
      const data: Partial<Item> & Record<string, unknown> = {
        archival: {
          ...(item.archival ?? {}),
          // Creator, extent and dimensions describe one document, so they are not given to the parts of
          // a record (AAMU-0073a–e); where the record is, and what kind of thing, are shared.
          creator: (exact ? orNull(row.Creator) : null) ?? item.archival?.creator ?? null,
          extent: (exact ? orNull(row.Extent) : null) ?? item.archival?.extent ?? null,
          dimensions: (exact ? orNull(row.Dimensions) : null) ?? item.archival?.dimensions ?? null,
          type: orNull(row.Type) ?? item.archival?.type ?? null,
          theme: orNull(row.Theme) ?? item.archival?.theme ?? null,
          repository: orNull(row.Repository) ?? item.archival?.repository ?? null,
          collection: orNull(row.Collection) ?? item.archival?.collection ?? null,
          box: orNull(row.Box) ?? item.archival?.box ?? null,
          folder: orNull(row.Folder) ?? item.archival?.folder ?? null,
          shelf: orNull(row.Shelf) ?? item.archival?.shelf ?? null,
          digitalCollection: orNull(row['Digital Collection']) ?? item.archival?.digitalCollection ?? null,
        },
      }
      if (orNull(row.Rights)) data.rights = row.Rights.trim()
      if (orNull(row.Language)) data.language = row.Language.trim()
      const ai = { ...(item.ai ?? {}) }
      const review = { ...(item.review ?? {}) }

      if (exact && orNull(row.Title)) {
        const date = orNull(row.Date)
        if (date && !DATE.test(date)) throw new Error(`${id}: unexpected date "${date}" in the catalog`)
        if (row.Title.trim() !== item.title) {
          if (!ai.originalTitle) ai.originalTitle = item.title
          data.title = row.Title.trim()
          report.titles++
        }
        if ((date ?? '') !== (item.date ?? '')) {
          if (!ai.originalDate && item.date) ai.originalDate = item.date
          data.date = date
          report.dates.push(`${id}: ${item.date || '(none)'} → ${date || '(undated)'}`)
        }
        review.titleChecked = true
      } else if (!exact) {
        report.catalogOnly++
      }

      const label = exact ? labelFor.get(id) : undefined
      if (label) {
        const description = `${label}\n\n${labels.credit}`
        if (description !== item.description) {
          if (!ai.originalDescription && item.description) ai.originalDescription = item.description
          data.description = description
          report.descriptions++
        }
        review.descriptionChecked = true
      }

      data.ai = ai
      data.review = review
      if (DRY_RUN) continue
      await payload.update({
        collection: 'items',
        id: item.id,
        // Keep each item's own state: a draft stays a draft, a published item stays published.
        data: { ...data, _status: item._status } as Partial<Item>,
        draft: item._status !== 'published',
        depth: 0,
        overrideAccess: true,
      })
    }
  }

  console.log(
    `\nTitles replaced by the catalog's: ${report.titles}\n` +
      `Dates changed to the catalog's: ${report.dates.length}\n${report.dates.map((d) => `  ${d}`).join('\n')}\n` +
      `Parts given a shared catalog record (AAMU-0073a–e): ${report.catalogOnly}\n` +
      `Descriptions from exhibit labels: ${report.descriptions}\n` +
      `Catalog rows with no item on the site: ${report.missing.join(', ') || 'none'}`,
  )
  process.exit(0)
}

await main()
