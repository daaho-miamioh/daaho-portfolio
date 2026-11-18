/**
 * Apply a reviewed correction plan to items, subjects and genres, and log every change.
 *
 *   PLAN=plan.json LOG=log.json pnpm apply:corrections               # local database
 *   PLAN=plan.json LOG=log.json pnpm apply:corrections:production    # the live site
 *   DRY_RUN=1 PLAN=plan.json pnpm apply:corrections                   # report only
 *
 * The plan comes from the metadata pipeline's MAP audit (scripts/map_audit.py there, D-020):
 *   items:    [{ itemId, set: { title | description | archival.<field>: value }, rules }]
 *   subjects: [{ from, to }]  rename a term; if `to` already exists, move every item to it and
 *                             delete `from`
 *   genres:   [{ itemId, add }] add an AAT genre, creating the term (with its AAT URI) if needed
 *
 * Every write keeps the item's status: a published item stays published, a draft stays a draft.
 * Review checks are left as they are, since these corrections change form, not substance. The
 * site's activity log records each save; LOG gets the before and after of every change too.
 */
import fs from 'node:fs'
import path from 'node:path'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import type { Item } from '@/payload-types'

const PLAN = process.env.PLAN
const LOG = process.env.LOG
const DRY_RUN = !!process.env.DRY_RUN
const PIPELINE_DIR = path.resolve(process.env.PIPELINE_DIR ?? '../daaho-metadata-pipeline')

type Plan = {
  items?: { itemId: string; set: Record<string, string>; rules?: string[] }[]
  subjects?: { from: string; to: string }[]
  genres?: { itemId: string; add: string; rule?: string }[]
}
type LogEntry = { kind: string; target: string; field?: string; before?: unknown; after?: unknown; note?: string }

const ids = (v: unknown) => ((v as unknown[]) ?? []).map((x) => (typeof x === 'object' && x ? (x as { id: number }).id : (x as number)))

function aatUris(): Map<string, string> {
  const map = new Map<string, string>()
  const file = path.join(PIPELINE_DIR, 'vocab', 'aat_genre.txt')
  if (!fs.existsSync(file)) return map
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([^#]+?)\s*#\s*aat:(\d+)/.exec(line)
    if (m) map.set(m[1].toLowerCase(), `http://vocab.getty.edu/aat/${m[2]}`)
  }
  return map
}

async function save(payload: Payload, item: Item, data: Record<string, unknown>) {
  if (DRY_RUN) return
  const draft = item._status !== 'published'
  await payload.update({
    collection: 'items',
    id: item.id,
    draft,
    data: { ...data, _status: draft ? 'draft' : 'published' },
    overrideAccess: true,
    context: { maintenance: true },
  })
}

async function itemById(payload: Payload, itemId: string) {
  const { docs } = await payload.find({ collection: 'items', where: { itemId: { equals: itemId } }, draft: true, depth: 0, limit: 1, overrideAccess: true })
  return docs[0] as Item | undefined
}

async function main() {
  if (!PLAN) throw new Error('Set PLAN to the correction plan (JSON).')
  const plan = JSON.parse(fs.readFileSync(path.resolve(PLAN), 'utf8')) as Plan
  const payload = await getPayload({ config })
  const log: LogEntry[] = []

  // 1. Subject terms: authorized FAST form, merging into an existing term where there is one.
  for (const { from, to } of plan.subjects ?? []) {
    const find = async (name: string) =>
      (await payload.find({ collection: 'subjects', where: { name: { equals: name } }, depth: 0, limit: 1, overrideAccess: true })).docs[0] as { id: number } | undefined
    const source = await find(from)
    if (!source) {
      log.push({ kind: 'subject', target: from, note: 'not on the site; skipped' })
      continue
    }
    const target = from.toLowerCase() === to.toLowerCase() ? undefined : await find(to)
    if (!target) {
      if (!DRY_RUN) await payload.update({ collection: 'subjects', id: source.id, data: { name: to }, overrideAccess: true })
      log.push({ kind: 'subject', target: from, field: 'name', before: from, after: to, note: 'renamed' })
      continue
    }
    const { docs } = await payload.find({ collection: 'items', where: { subjects: { in: [source.id] } }, draft: true, depth: 0, pagination: false, overrideAccess: true })
    for (const item of docs as Item[]) {
      const before = ids(item.subjects)
      const after = [...new Set(before.map((x) => (x === source.id ? target.id : x)))]
      await save(payload, item, { subjects: after })
      log.push({ kind: 'item', target: item.itemId, field: 'subjects', before: from, after: to, note: 'merged into the existing term' })
    }
    if (!DRY_RUN) await payload.delete({ collection: 'subjects', id: source.id, overrideAccess: true })
    log.push({ kind: 'subject', target: from, note: `merged into "${to}" (${docs.length} items) and deleted` })
  }

  // 2. Item fields.
  for (const entry of plan.items ?? []) {
    const item = await itemById(payload, entry.itemId)
    if (!item) {
      log.push({ kind: 'item', target: entry.itemId, note: 'not found; skipped' })
      continue
    }
    const data: Record<string, unknown> = {}
    const archival = { ...(item.archival ?? {}) } as Record<string, unknown>
    for (const [field, value] of Object.entries(entry.set)) {
      if (field.startsWith('archival.')) {
        const key = field.slice('archival.'.length)
        log.push({ kind: 'item', target: entry.itemId, field, before: archival[key] ?? null, after: value, note: (entry.rules ?? []).join(' ') })
        archival[key] = value
        data.archival = archival
      } else {
        log.push({ kind: 'item', target: entry.itemId, field, before: (item as unknown as Record<string, unknown>)[field] ?? null, after: value, note: (entry.rules ?? []).join(' ') })
        data[field] = value
      }
    }
    await save(payload, item, data)
  }

  // 3. Genres.
  const aat = aatUris()
  for (const { itemId, add, rule } of plan.genres ?? []) {
    const item = await itemById(payload, itemId)
    if (!item) continue
    let genre = (await payload.find({ collection: 'genres', where: { name: { equals: add } }, depth: 0, limit: 1, overrideAccess: true })).docs[0] as { id: number } | undefined
    if (!genre && !DRY_RUN) {
      genre = (await payload.create({ collection: 'genres', data: { name: add, authorityUri: aat.get(add.toLowerCase()) ?? null }, overrideAccess: true })) as { id: number }
      log.push({ kind: 'genre', target: add, note: 'created' })
    }
    const before = ids(item.genres)
    if (genre && before.includes(genre.id)) continue
    await save(payload, item, { genres: [...before, ...(genre ? [genre.id] : [])] })
    log.push({ kind: 'item', target: itemId, field: 'genres', before: null, after: add, note: rule ?? '' })
  }

  const summary = log.reduce<Record<string, number>>((acc, e) => ((acc[`${e.kind}${e.field ? `.${e.field}` : ''}`] = (acc[`${e.kind}${e.field ? `.${e.field}` : ''}`] ?? 0) + 1), acc), {})
  console.log(DRY_RUN ? 'DRY_RUN: nothing written.' : 'Applied.', summary)
  if (LOG) fs.writeFileSync(path.resolve(LOG), JSON.stringify({ at: new Date().toISOString(), dryRun: DRY_RUN, plan: PLAN, log }, null, 1))
  process.exit(0)
}

// Awaited at the top level: `payload run` exits once this module has loaded.
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
