/**
 * Import historical context events from a JSON file, as drafts awaiting review.
 *
 *   pnpm import:events                      # data/context-events.json
 *   EVENTS_FILE=path/to.json pnpm import:events
 *
 * Create-only: an event whose slug already exists is left as it is, so re-running never overwrites
 * an editor's review. Every imported event is a draft marked "AI-drafted, not reviewed" unless the
 * file says otherwise, and cannot be published until someone reviews it and adds a source.
 *
 * File format: an array of
 *   { "title", "names": [{ "language": "zh"|"ja"|"ko"|..., "name" }], "startDate", "endDate"?,
 *     "regions": ["China", ...], "importance": "major"|"notable", "summary",
 *     "sources"?: [{ "citation", "url"? }], "draftedBy"? }
 */
import fs from 'node:fs'
import path from 'node:path'

import config from '@payload-config'
import { getPayload } from 'payload'

import { slugify } from '@/lib/slug'

type EventIn = {
  title: string
  names?: { language: string; name: string }[]
  startDate: string
  endDate?: string
  regions: string[]
  importance?: 'major' | 'notable'
  summary: string
  sources?: { citation: string; url?: string }[]
  draftedBy?: string
}


/** Where this run will write, without credentials — printed before anything is written. */
function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

const file = path.resolve(process.env.EVENTS_FILE ?? 'data/context-events.json')
const events = JSON.parse(fs.readFileSync(file, 'utf8')) as EventIn[]
console.log(`Database: ${describeDatabase()}`)
const payload = await getPayload({ config })
let created = 0
for (const e of events) {
  const slug = slugify(e.title)
  const existing = await payload.find({ collection: 'events', where: { slug: { equals: slug } }, limit: 1, draft: true, overrideAccess: true })
  if (existing.totalDocs) continue
  await payload.create({
    collection: 'events',
    draft: true,
    data: {
      title: e.title,
      slug,
      names: (e.names ?? []) as never,
      startDate: e.startDate,
      endDate: e.endDate ?? null,
      regions: e.regions as never,
      importance: e.importance ?? 'notable',
      summary: e.summary,
      sources: e.sources ?? [],
      draftedBy: e.draftedBy ?? null,
      review: { status: 'ai_drafted' },
      _status: 'draft',
    },
    overrideAccess: true,
  })
  created++
}
console.log(`Imported ${created} events (${events.length - created} already present) from ${file}.`)
process.exit(0)
