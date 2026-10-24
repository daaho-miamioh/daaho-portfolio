import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Item, User } from '@/payload-types'

/**
 * Things done in the admin: bulk actions on the item list, done the way the admin does them (one
 * update over a where-query, as the signed-in editor), and naming who checked a record.
 * Throwaway records, deleted afterwards.
 */
let payload: Payload
const stamp = Date.now()
const ids = { users: [] as number[], media: [] as number[], items: [] as number[], people: [] as number[], events: [] as number[] }
let admin: User
let editor: User
let mediaId: number
let personId: number
let settingsBefore: { allowUnreviewedPublishing?: boolean | null; defaultRights?: string | null }
const as = (u: User) => ({ user: { ...u, collection: 'users' } as never, overrideAccess: false as const })

async function user(role: 'admin' | 'editor') {
  const doc = await payload.create({ collection: 'users', data: { email: `${role}-bulk${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role } })
  ids.users.push(doc.id)
  return doc as User
}

/** Published, with its own scan, and naming the same person as the others: as real letters do. */
async function publishedItem() {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } }).png().toBuffer()
  const scan = await payload.create({ collection: 'media', data: { alt: 'scan', public: false }, file: { data: png, mimetype: 'image/png', name: `bulk-${stamp}-${ids.media.length}.png`, size: png.length } })
  ids.media.push(scan.id)
  const doc = (await payload.create({
    collection: 'items',
    data: {
      itemId: `BULK-${stamp}-${ids.items.length}`, title: 'Bulk test item', transcript: 'Text', rights: 'In copyright',
      pages: [{ image: mediaId }, { image: scan.id }], people: [{ person: personId, role: 'correspondent' }], review: { linksChecked: true }, _status: 'published',
    } as Item,
  })) as Item
  ids.items.push(doc.id)
  return doc
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const s = await payload.findGlobal({ slug: 'settings', depth: 0 })
  settingsBefore = { allowUnreviewedPublishing: s.allowUnreviewedPublishing, defaultRights: s.defaultRights }
  // As on the live site: items are published before every part is checked.
  await payload.updateGlobal({ slug: 'settings', data: { allowUnreviewedPublishing: true } })
  admin = await user('admin')
  editor = await user('editor')
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } }).png().toBuffer()
  const media = await payload.create({ collection: 'media', data: { alt: 'test', public: false }, file: { data: png, mimetype: 'image/png', name: `bulk-${stamp}.png`, size: png.length } })
  mediaId = media.id
  ids.media.push(media.id)
  const person = await payload.create({ collection: 'people', data: { name: `Bulk Person ${stamp}`, aliases: [{ value: 'B. Person' }, { value: 'Bee Person' }] } as never })
  personId = person.id
  ids.people.push(person.id)
})

afterAll(async () => {
  await payload.updateGlobal({ slug: 'settings', data: settingsBefore })
  for (const id of ids.items) await payload.delete({ collection: 'items', id }).catch(() => {})
  for (const id of ids.events) await payload.delete({ collection: 'events', id }).catch(() => {})
  for (const id of ids.media) await payload.delete({ collection: 'media', id }).catch(() => {})
  for (const id of ids.people) await payload.delete({ collection: 'people', id }).catch(() => {})
  for (const id of ids.users) await payload.delete({ collection: 'users', id })
})

describe('bulk actions on items', () => {
  it('unpublish several items at once', async () => {
    const items = [await publishedItem(), await publishedItem(), await publishedItem(), await publishedItem()]
    const res = await payload.update({
      collection: 'items',
      where: { and: [{ _status: { not_equals: 'draft' } }, { id: { in: items.map((i) => i.id) } }] },
      data: { _status: 'draft' },
      ...as(editor),
    })
    expect(res.errors).toEqual([])
    expect(res.docs).toHaveLength(4)
    for (const { id } of items) expect((await payload.findByID({ collection: 'items', id, depth: 0 }))._status).toBe('draft')
    // Their person is no longer in any published item, so is no longer public.
    expect((await payload.findByID({ collection: 'people', id: personId, depth: 0 })).public).toBe(false)
  })

  it('delete several items at once, taking their scans and people out of public view', async () => {
    const items = [await publishedItem(), await publishedItem()]
    const scans = items.flatMap((i) => (i.pages ?? []).map((p) => (typeof p.image === 'object' ? p.image.id : p.image)))
    expect((await payload.findByID({ collection: 'people', id: personId, depth: 0 })).public).toBe(true)
    const res = await payload.delete({ collection: 'items', where: { id: { in: items.map((i) => i.id) } }, ...as(editor) })
    expect(res.errors).toEqual([])
    // Really gone: a failed lookup in a hook once rolled the delete back while reporting success.
    expect((await payload.find({ collection: 'items', where: { id: { in: items.map((i) => i.id) } }, depth: 0 })).totalDocs).toBe(0)
    expect((await payload.findByID({ collection: 'people', id: personId, depth: 0 })).public).toBe(false)
    for (const id of scans.filter((id) => id !== mediaId)) expect((await payload.findByID({ collection: 'media', id: id as number, depth: 0 })).public).toBe(false)
  })

  it('publish several drafts at once', async () => {
    const a = await publishedItem()
    const b = await publishedItem()
    await payload.update({ collection: 'items', where: { id: { in: [a.id, b.id] } }, data: { _status: 'draft' }, ...as(editor) })
    const res = await payload.update({
      collection: 'items',
      where: { and: [{ _status: { not_equals: 'published' } }, { id: { in: [a.id, b.id] } }] },
      data: { _status: 'published' },
      draft: true,
      ...as(editor),
    })
    expect(res.errors).toEqual([])
    for (const id of [a.id, b.id]) expect((await payload.findByID({ collection: 'items', id, depth: 0 }))._status).toBe('published')
  })
})

const idOf = (v: unknown) => (typeof v === 'object' && v ? (v as { id: number }).id : v)

describe('who checked', () => {
  it('is whoever ticks the box, unless they choose someone else', async () => {
    const it_ = await publishedItem()
    const save = (review: Record<string, unknown>) =>
      payload.update({ collection: 'items', id: it_.id, data: { review }, depth: 0, ...as(editor) }) as Promise<Item>

    let doc = await save({ ...it_.review, titleChecked: true })
    expect(idOf(doc.review?.reviewedBy)).toBe(editor.id)

    // A check done by a colleague: the editor ticks the box and chooses the colleague.
    doc = await save({ ...doc.review, descriptionChecked: true, reviewedBy: admin.id })
    expect(idOf(doc.review?.reviewedBy)).toBe(admin.id)
    expect(doc.review?.reviewedAt).toBeTruthy()

    // The next check, with the name left as it was, is the editor's own again.
    doc = await save({ ...doc.review, reviewedBy: idOf(doc.review?.reviewedBy), transcriptChecked: true })
    expect(idOf(doc.review?.reviewedBy)).toBe(editor.id)
  })

  it('can be chosen for a historical context and a translation', async () => {
    const ev = await payload.create({
      collection: 'events',
      draft: true,
      data: { title: `Who checked ${stamp}`, startDate: '1937-07-07', regions: ['China'], summary: 'A test event.', _status: 'draft' },
    })
    ids.events.push(ev.id)
    const reviewed = await payload.update({ collection: 'events', id: ev.id, draft: true, data: { review: { status: 'reviewed', reviewedBy: admin.id } }, depth: 0, ...as(editor) })
    expect(idOf(reviewed.review?.reviewedBy)).toBe(admin.id)
    const mine = await payload.update({ collection: 'events', id: ev.id, draft: true, data: { review: { status: 'ai_drafted' } }, depth: 0, ...as(editor) })
    expect(mine.review?.reviewedBy ?? null).toBeNull()
    const again = await payload.update({ collection: 'events', id: ev.id, draft: true, data: { review: { status: 'reviewed' } }, depth: 0, ...as(editor) })
    expect(idOf(again.review?.reviewedBy)).toBe(editor.id)

    const it_ = await publishedItem()
    const t = await payload.update({
      collection: 'items',
      id: it_.id,
      data: { translation: { text: 'A translation.', status: 'verified', verifiedBy: admin.id } } as Partial<Item>,
      depth: 0,
      ...as(editor),
    })
    expect(idOf(t.translation?.verifiedBy)).toBe(admin.id)
  })
})
