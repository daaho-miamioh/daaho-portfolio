import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

/**
 * The rules an archival site must enforce, exercised against a real database. Everything here
 * uses throwaway records that are deleted afterwards; imported data is never touched.
 */
let payload: Payload
const stamp = Date.now()
const ids = { users: [] as number[], media: [] as number[], items: [] as number[] }
let editor: User
let contributor: User
let mediaId: number

async function user(role: 'admin' | 'editor' | 'contributor') {
  const doc = await payload.create({
    collection: 'users',
    data: { email: `${role}-${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role },
  })
  ids.users.push(doc.id)
  return doc as User
}

async function draftItem(extra: Record<string, unknown> = {}) {
  const doc = await payload.create({
    collection: 'items',
    draft: true,
    data: { itemId: `TEST-${stamp}-${ids.items.length}`, title: 'Test item', pages: [{ image: mediaId }], _status: 'draft', ...extra },
  })
  ids.items.push(doc.id)
  return doc
}

const isPublic = async (id: number) => (await payload.findByID({ collection: 'media', id, depth: 0 })).public

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  // If the database has no users, the first account is promoted to admin by design — create one
  // first so the editor and contributor below keep the roles we ask for.
  await user('admin')
  editor = await user('editor')
  contributor = await user('contributor')
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#888' } }).png().toBuffer()
  const media = await payload.create({
    collection: 'media',
    data: { alt: 'test', public: false },
    file: { data: png, mimetype: 'image/png', name: `test-${stamp}.png`, size: png.length },
  })
  mediaId = media.id
  ids.media.push(media.id)
})

afterAll(async () => {
  for (const id of ids.items) await payload.delete({ collection: 'items', id })
  for (const id of ids.media) await payload.delete({ collection: 'media', id })
  for (const id of ids.users) await payload.delete({ collection: 'users', id })
})

describe('publishing rules', () => {
  it('refuses to publish an AI description nobody has reviewed', async () => {
    const item = await draftItem({ rights: 'In copyright' })
    await expect(
      payload.update({ collection: 'items', id: item.id, data: { _status: 'published' }, user: editor, overrideAccess: false }),
    ).rejects.toThrow(/Reviewed/)
  })

  it('publishes an unreviewed item only when Site settings allow it, and never without rights', async () => {
    const before = await payload.findGlobal({ slug: 'settings', depth: 0 })
    try {
      await payload.updateGlobal({ slug: 'settings', data: { allowUnreviewedPublishing: true, defaultRights: null } })
      const noRights = await draftItem()
      await expect(
        payload.update({ collection: 'items', id: noRights.id, data: { _status: 'published' }, user: editor, overrideAccess: false }),
      ).rejects.toThrow(/rights statement/)
      const ok = await draftItem({ rights: 'In copyright' })
      const published = await payload.update({ collection: 'items', id: ok.id, data: { _status: 'published' }, user: editor, overrideAccess: false })
      expect(published._status).toBe('published')
      expect(published.review?.status).toBe('ai_generated') // published, but not falsely marked reviewed
    } finally {
      await payload.updateGlobal({
        slug: 'settings',
        data: { allowUnreviewedPublishing: !!before.allowUnreviewedPublishing, defaultRights: before.defaultRights ?? null },
      })
    }
  })

  it('refuses to publish without a rights statement', async () => {
    const item = await draftItem({ review: { status: 'reviewed' } })
    await expect(
      payload.update({ collection: 'items', id: item.id, data: { _status: 'published' }, user: editor, overrideAccess: false }),
    ).rejects.toThrow(/rights statement/)
  })

  it('does not let a contributor publish, even a reviewed item with rights', async () => {
    const item = await draftItem({ review: { status: 'reviewed' }, rights: 'In copyright' })
    await expect(
      payload.update({ collection: 'items', id: item.id, data: { _status: 'published' }, user: contributor, overrideAccess: false }),
    ).rejects.toThrow(/cannot publish/)
  })

  it('records who reviewed the item and when', async () => {
    const item = await draftItem()
    const updated = await payload.update({
      collection: 'items',
      id: item.id,
      draft: true,
      data: { review: { status: 'reviewed' } },
      user: editor,
      overrideAccess: false,
      depth: 0,
    })
    expect(updated.review?.reviewedBy).toBe(editor.id)
    expect(updated.review?.reviewedAt).toBeTruthy()
  })

  it('makes scans public on publish and private again on unpublish', async () => {
    const item = await draftItem({ review: { status: 'reviewed' }, rights: 'In copyright' })
    expect(await isPublic(mediaId)).toBe(false)

    await payload.update({ collection: 'items', id: item.id, data: { _status: 'published' }, user: editor, overrideAccess: false })
    expect(await isPublic(mediaId)).toBe(true)

    await payload.update({ collection: 'items', id: item.id, data: { _status: 'draft' }, user: editor, overrideAccess: false })
    expect(await isPublic(mediaId)).toBe(false)
  })

  it('shows the public published items only', async () => {
    const item = await draftItem()
    const anonymous = await payload.find({
      collection: 'items',
      where: { id: { equals: item.id } },
      overrideAccess: false,
    })
    expect(anonymous.totalDocs).toBe(0)
  })

  it('keeps a person private until an item naming them is published', async () => {
    const person = await payload.create({
      collection: 'people',
      data: { name: `Test, Person ${stamp}`, kind: 'person', _status: 'published' },
    })
    const visible = async () =>
      (await payload.find({ collection: 'people', where: { id: { equals: person.id } }, overrideAccess: false })).totalDocs
    try {
      const item = await draftItem({ review: { status: 'reviewed' }, rights: 'In copyright', people: [{ person: person.id, role: 'creator' }] })
      expect(await visible()).toBe(0)

      await payload.update({ collection: 'items', id: item.id, data: { _status: 'published' }, user: editor, overrideAccess: false })
      expect(await visible()).toBe(1)

      await payload.update({ collection: 'items', id: item.id, data: { _status: 'draft' }, user: editor, overrideAccess: false })
      expect(await visible()).toBe(0)
    } finally {
      for (const id of ids.items.splice(0)) await payload.delete({ collection: 'items', id })
      await payload.delete({ collection: 'people', id: person.id })
    }
  })

  it('hides a private scan from the public', async () => {
    const anonymous = await payload.find({ collection: 'media', where: { id: { equals: mediaId } }, overrideAccess: false })
    expect(anonymous.totalDocs).toBe(0)
  })
})
