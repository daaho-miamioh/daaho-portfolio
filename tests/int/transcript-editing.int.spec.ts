import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

/**
 * Correcting a transcript from the item page (TranscriptEditor): the same saves the editor sends.
 * An editor's correction to a published item is published; a contributor's stays a draft until an
 * editor publishes it; each save names its author in the activity log.
 */
let payload: Payload
const stamp = Date.now()
const ids = { users: [] as number[], items: [] as number[], media: [] as number[] }
let editor: User
let contributor: User
let itemId: number

async function user(role: 'editor' | 'contributor') {
  const doc = await payload.create({ collection: 'users', data: { email: `${role}-t${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role } })
  ids.users.push(doc.id)
  return doc as User
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  editor = await user('editor')
  contributor = await user('contributor')
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer()
  const media = await payload.create({ collection: 'media', data: { alt: 'scan', public: false }, file: { data: png, mimetype: 'image/png', name: `t-${stamp}.png`, size: png.length } })
  ids.media.push(media.id)
  const item = await payload.create({
    collection: 'items',
    data: {
      itemId: `TED-${stamp}`,
      title: 'Test letter',
      format: 'document',
      pages: [{ image: media.id }],
      transcript: '[page 1]\nDear Sir, I recieve your letter.',
      rights: 'In copyright',
      review: { titleChecked: true, descriptionChecked: true, transcriptChecked: true, linksChecked: true },
      _status: 'published',
    } as never,
  })
  itemId = item.id
  ids.items.push(item.id)
})

afterAll(async () => {
  for (const id of ids.items) await payload.delete({ collection: 'items', id, overrideAccess: true })
  for (const id of ids.media) await payload.delete({ collection: 'media', id, overrideAccess: true })
  for (const id of ids.users) await payload.delete({ collection: 'users', id, overrideAccess: true })
})

const published = async () => (await payload.findByID({ collection: 'items', id: itemId, depth: 0, overrideAccess: true })).transcript
const latest = async () => (await payload.findByID({ collection: 'items', id: itemId, depth: 0, draft: true, overrideAccess: true })).transcript

describe('correcting a transcript on the item page', () => {
  it("keeps a contributor's correction as a draft and the published text as it was", async () => {
    await payload.update({
      collection: 'items',
      id: itemId,
      draft: true,
      data: { transcript: '[page 1]\nDear Sir, I recieve [receive] your letter.', _status: 'draft' },
      user: contributor,
      overrideAccess: false,
    })
    expect(await published()).toBe('[page 1]\nDear Sir, I recieve your letter.')
    expect(await latest()).toContain('[receive]')
  })

  it("publishes an editor's correction, and logs who made it", async () => {
    await payload.update({
      collection: 'items',
      id: itemId,
      data: { transcript: '[page 1]\nDear Sir, I recieve [receive] your kind letter.', _status: 'published' },
      user: editor,
      overrideAccess: false,
    })
    expect(await published()).toContain('your kind letter')
    const log = await payload.find({
      collection: 'activity',
      where: { and: [{ recordId: { equals: String(itemId) } }, { who: { equals: 'Test editor' } }] },
      overrideAccess: true,
      depth: 0,
    })
    expect(log.totalDocs).toBeGreaterThan(0)
  })

  it('does not let a contributor publish a correction', async () => {
    await expect(
      payload.update({ collection: 'items', id: itemId, data: { transcript: 'x', _status: 'published' }, user: contributor, overrideAccess: false }),
    ).rejects.toThrow(/cannot publish/)
  })
})
