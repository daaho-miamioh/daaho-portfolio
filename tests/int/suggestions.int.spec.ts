import config from '@/payload.config'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { suggestAnnotation } from '@/lib/suggestions'
import type { User } from '@/payload-types'

/** Visitors suggest notes on public transcripts; nothing is public until an editor approves it. */
let payload: Payload
const stamp = Date.now()
const ids = { users: [] as number[], items: [] as number[], media: [] as number[], annotations: [] as number[] }
let editor: User
let published: number
let draft: number
const TEXT = '[page 1]\nDear Mr. Huang, we are glad to welcome you to Miami.'
const human = async () => ({ ok: true as const })
const robot = async () => ({ ok: false as const, reason: 'failed' as const })

const visitor = async (ip = '203.0.113.9') => {
  const req = (await createLocalReq({}, payload)) as PayloadRequest
  req.headers.set('x-forwarded-for', ip)
  return req
}
const suggestion = (more: Record<string, unknown> = {}) => ({
  item: published,
  quote: 'Mr. Huang',
  start: TEXT.indexOf('Mr. Huang'),
  category: 'person',
  body: 'Chin-Wu Huang, a student from Shanghai.',
  name: 'A reader',
  email: 'reader@example.org',
  recaptcha: 'token',
  ...more,
})

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const u = await payload.create({ collection: 'users', data: { email: `editor-s${stamp}@test.invalid`, password: `pw-${stamp}`, name: 'Test editor', role: 'editor' } })
  ids.users.push(u.id)
  editor = u as User
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer()
  const media = await payload.create({ collection: 'media', data: { alt: 'scan', public: false }, file: { data: png, mimetype: 'image/png', name: `s-${stamp}.png`, size: png.length } })
  ids.media.push(media.id)
  const base = { title: 'Test letter', pages: [{ image: media.id }], transcript: TEXT, rights: 'In copyright', review: { titleChecked: true, descriptionChecked: true, transcriptChecked: true, linksChecked: true } }
  published = (await payload.create({ collection: 'items', data: { ...base, format: 'document', itemId: `SUG-${stamp}-1`, _status: 'published' } as never })).id
  draft = (await payload.create({ collection: 'items', draft: true, data: { ...base, itemId: `SUG-${stamp}-2`, _status: 'draft' } })).id
  ids.items.push(published, draft)
})

afterAll(async () => {
  const mine = await payload.find({ collection: 'annotations', where: { item: { in: ids.items } }, depth: 0, overrideAccess: true, pagination: false })
  for (const a of mine.docs) await payload.delete({ collection: 'annotations', id: a.id, overrideAccess: true })
  for (const id of ids.items) await payload.delete({ collection: 'items', id, overrideAccess: true })
  for (const id of ids.media) await payload.delete({ collection: 'media', id, overrideAccess: true })
  for (const id of ids.users) await payload.delete({ collection: 'users', id, overrideAccess: true })
})

describe('visitor suggestions', () => {
  it('keeps a person’s note as submitted, hidden from the public, with who sent it for staff only', async () => {
    expect(await suggestAnnotation(await visitor(), suggestion(), human)).toEqual({ ok: true })
    const [a] = (await payload.find({ collection: 'annotations', where: { item: { equals: published } }, depth: 0, overrideAccess: true })).docs
    expect(a).toMatchObject({ status: 'submitted', source: 'public', quote: 'Mr. Huang', submitterName: 'A reader', author: null })
    const asPublic = await payload.find({ collection: 'annotations', where: { item: { equals: published } }, overrideAccess: false })
    expect(asPublic.docs).toHaveLength(0)
    // An editor approves it; then the public sees the note, but not the visitor's email.
    await payload.update({ collection: 'annotations', id: a.id, data: { status: 'approved' }, user: editor, overrideAccess: false })
    const seen = (await payload.find({ collection: 'annotations', where: { item: { equals: published } }, overrideAccess: false })).docs[0]
    expect(seen.body).toContain('Chin-Wu Huang')
    expect(seen.submitterEmail).toBeUndefined()
  })

  it('refuses a robot, a draft item, and a passage that is not in the transcript', async () => {
    await expect(suggestAnnotation(await visitor(), suggestion(), robot)).rejects.toThrow(/not a robot/)
    await expect(suggestAnnotation(await visitor(), suggestion({ item: draft }), human)).rejects.toThrow(/cannot take suggestions/)
    await expect(suggestAnnotation(await visitor(), suggestion({ quote: 'Mrs. Upham', start: null }), human)).rejects.toThrow(/not found/)
  })

  it('pretends to accept a bot that fills the hidden field, and keeps nothing', async () => {
    const before = await payload.count({ collection: 'annotations', where: { item: { equals: published } }, overrideAccess: true })
    expect(await suggestAnnotation(await visitor(), suggestion({ website: 'spam.example' }), robot)).toEqual({ ok: true })
    expect((await payload.count({ collection: 'annotations', where: { item: { equals: published } }, overrideAccess: true })).totalDocs).toBe(before.totalDocs)
  })

  it('limits how many one source sends in an hour', async () => {
    const ip = '198.51.100.77'
    for (let i = 0; i < 5; i++) await suggestAnnotation(await visitor(ip), suggestion({ body: `Note number ${i} on this passage.` }), human)
    await expect(suggestAnnotation(await visitor(ip), suggestion(), human)).rejects.toThrow(/later/)
  })
})
