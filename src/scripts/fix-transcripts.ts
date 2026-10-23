/**
 * Correct misreadings in AI transcripts, from data/catalog/transcript-fixes.json.
 *
 *   pnpm fix:transcripts                   local database
 *   DRY_RUN=1 pnpm fix:transcripts         list what would change, change nothing
 *   pnpm fix:transcripts:production        the live database
 *
 * Each edit is an exact replacement and must match as many times as it says, or the item is left
 * alone and reported. The AI's text stays in the item's version history, and a staff note says what
 * was corrected. The transcript is not marked checked: that waits for someone to read it through.
 *
 * Safe to run again: an edit already made is skipped.
 */
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { Item } from '@/payload-types'

const FIXES = path.resolve('data/catalog/transcript-fixes.json')
const DRY_RUN = !!process.env.DRY_RUN

type Edit = { page?: number; from: string; to: string; count?: number; why?: string }
type Fixes = { checkedOn: string; items: { itemId: string; edits: Edit[] }[] }

function describeDatabase(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.pathname} (${process.env.NODE_ENV === 'production' ? 'production mode' : 'development mode'})`
  } catch {
    return '(DATABASE_URL not set)'
  }
}

const occurrences = (text: string, s: string) => text.split(s).length - 1

/** The corrected text, or the reason it could not be corrected. */
function apply(text: string, edits: Edit[]): { text: string; made: Edit[] } | { error: string } {
  const made: Edit[] = []
  for (const e of edits) {
    const want = e.count ?? 1
    const found = occurrences(text, e.from)
    if (found === 0 && text.includes(e.to)) continue
    if (found !== want) return { error: `"${e.from}" found ${found} times, expected ${want}` }
    text = text.split(e.from).join(e.to)
    made.push(e)
  }
  return { text, made }
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

  const fixes = JSON.parse(fs.readFileSync(FIXES, 'utf8')) as Fixes
  const failed: string[] = []

  for (const { itemId, edits } of fixes.items) {
    const item = (await payload.find({ collection: 'items', where: { itemId: { equals: itemId } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs[0] as Item | undefined
    if (!item) {
      failed.push(`${itemId}: not on the site`)
      continue
    }
    const result = apply(item.transcript ?? '', edits)
    if ('error' in result) {
      failed.push(`${itemId}: ${result.error}; left unchanged`)
      continue
    }
    console.log(`\n${itemId}: ${result.made.length} of ${edits.length} corrections to make`)
    for (const e of result.made) console.log(`  p.${e.page ?? '?'}  "${e.from}" → "${e.to}"${e.count && e.count > 1 ? ` (×${e.count})` : ''}`)
    if (!result.made.length || DRY_RUN) continue

    const changes = result.made.map((e) => `“${e.from}” → “${e.to}”`).join('; ')
    const note = `Transcript corrected against the scan on ${fixes.checkedOn}: ${changes}. The AI's text is in Versions. It still needs reading through before it is checked.`
    await payload
      .update({
        collection: 'items',
        id: item.id,
        // Keep the item's own state: a draft stays a draft, a published item stays published.
        data: { transcript: result.text, review: { ...(item.review ?? {}), notes: [item.review?.notes, note].filter(Boolean).join('\n\n') }, _status: item._status } as Partial<Item>,
        draft: item._status !== 'published',
        depth: 0,
        overrideAccess: true,
      })
      .catch((err: Error) => failed.push(`${itemId}: ${err.message}`))
  }

  if (failed.length) console.log(`\nNot corrected:\n${failed.map((f) => `  ${f}`).join('\n')}`)
  process.exit(failed.length ? 1 : 0)
}

await main()
