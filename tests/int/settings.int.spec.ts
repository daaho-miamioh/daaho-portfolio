import config from '@/payload.config'
import { getPayload, type Payload, type PayloadRequest, type Where } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readMedia } from '@/collections/Media'
import type { Media, User } from '@/payload-types'

/** Site-wide decisions: a default rights statement, and whether the public gets original files. */
let payload: Payload
const stamp = Date.now()
const made = { users: [] as number[], items: [] as number[], media: [] as number[] }
let editor: User
let media: Media
let before: { defaultRights?: string | null; allowFullResolution?: boolean | null }

const setSettings = (data: { defaultRights?: string | null; allowFullResolution?: boolean }) =>
  payload.updateGlobal({ slug: 'settings', data, depth: 0 })

/** What an anonymous request for this filename would be allowed to read. */
async function publicCanFetch(filename: string) {
  const req = { user: null, payload, routeParams: { filename } } as unknown as PayloadRequest
  const where = (await readMedia({ req } as Parameters<typeof readMedia>[0])) as Where
  const found = await payload.find({ collection: 'media', where: { and: [where, { id: { equals: media.id } }] }, depth: 0 })
  return found.totalDocs === 1
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  before = await payload.findGlobal({ slug: 'settings', depth: 0 })
  for (const role of ['admin', 'editor'] as const) {
    const u = await payload.create({
      collection: 'users',
      data: { email: `${role}-s${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role },
    })
    made.users.push(u.id)
    if (role === 'editor') editor = u as User
  }
  const png = await sharp({ create: { width: 2400, height: 3000, channels: 3, background: '#888' } }).png().toBuffer()
  media = (await payload.create({
    collection: 'media',
    data: { alt: 'test', public: true },
    file: { data: png, mimetype: 'image/png', name: `settings-${stamp}.png`, size: png.length },
  })) as Media
  made.media.push(media.id)
})

afterAll(async () => {
  await setSettings({ defaultRights: before.defaultRights ?? null, allowFullResolution: !!before.allowFullResolution })
  for (const id of made.items) await payload.delete({ collection: 'items', id }).catch(() => {})
  for (const id of made.media) await payload.delete({ collection: 'media', id })
  for (const id of made.users) await payload.delete({ collection: 'users', id })
})

describe('default rights statement', () => {
  it('lets an item without its own statement be published once a default is set', async () => {
    const item = await payload.create({
      collection: 'items',
      draft: true,
      data: { itemId: `S-${stamp}`, title: 'Settings test', review: { status: 'reviewed' }, _status: 'draft' },
    })
    made.items.push(item.id)
    await setSettings({ defaultRights: null })
    await expect(
      payload.update({ collection: 'items', id: item.id, data: { _status: 'published' }, user: editor, overrideAccess: false }),
    ).rejects.toThrow(/rights statement/)
    await setSettings({ defaultRights: '© Miami University. Test statement.' })
    const published = await payload.update({ collection: 'items', id: item.id, data: { _status: 'published' }, user: editor, overrideAccess: false })
    expect(published._status).toBe('published')
  })
})

describe('full-resolution files', () => {
  it('serves the public the reading size but not the original while full resolution is off', async () => {
    await setSettings({ allowFullResolution: false })
    expect(media.sizes?.reading?.filename).toBeTruthy()
    expect(await publicCanFetch(media.sizes!.reading!.filename!)).toBe(true)
    expect(await publicCanFetch(media.filename!)).toBe(false)
  })

  it('serves a small original that has no reading size, since it is what the page shows', async () => {
    await setSettings({ allowFullResolution: false })
    const png = await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#777' } }).png().toBuffer()
    const small = (await payload.create({
      collection: 'media',
      data: { alt: 'small', public: true },
      file: { data: png, mimetype: 'image/png', name: `small-${stamp}.png`, size: png.length },
    })) as Media
    made.media.push(small.id)
    expect(small.sizes?.reading?.filename ?? null).toBeNull()
    const req = { user: null, payload, routeParams: { filename: small.filename } } as unknown as PayloadRequest
    const where = (await readMedia({ req } as Parameters<typeof readMedia>[0])) as Where
    const found = await payload.find({ collection: 'media', where: { and: [where, { id: { equals: small.id } }] }, depth: 0 })
    expect(found.totalDocs).toBe(1)
  })

  it('serves the original once full resolution is allowed', async () => {
    await setSettings({ allowFullResolution: true })
    expect(await publicCanFetch(media.filename!)).toBe(true)
  })
})
