import config from '@/payload.config'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { markdownToLexical } from '@/lib/markdownToLexical'
import type { Item, Story, User } from '@/payload-types'

/** Stories: who may write them, when they are public, and what they show of the documents they cite. */
let payload: Payload
const stamp = Date.now()
const made = { users: [] as number[], stories: [] as number[], items: [] as number[], media: [] as number[] }
let editor: User
let contributor: User
let settingsBefore: boolean | null | undefined
const staff = (u: User) => ({ user: { ...u, collection: 'users' } as never, overrideAccess: false as const })

async function user(role: 'editor' | 'contributor') {
  const doc = await payload.create({ collection: 'users', data: { email: `${role}-st${stamp}@test.invalid`, password: `pw-${stamp}`, name: `Test ${role}`, role } })
  made.users.push(doc.id)
  return doc as User
}
async function portrait() {
  const doc = await payload.create({ collection: 'media', data: { alt: 'Portrait', public: false }, filePath: path.resolve('tests/fixtures/pixel.png') })
  made.media.push(doc.id)
  return doc.id
}
const publicStory = async (id: number) => (await payload.find({ collection: 'stories', where: { id: { equals: id } }, depth: 2, overrideAccess: false })).docs[0] as Story | undefined

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  settingsBefore = (await payload.findGlobal({ slug: 'settings', depth: 0 })).allowUnreviewedPublishing
  await payload.updateGlobal({ slug: 'settings', data: { allowUnreviewedPublishing: true } })
  editor = await user('editor')
  contributor = await user('contributor')
})

afterAll(async () => {
  await payload.updateGlobal({ slug: 'settings', data: { allowUnreviewedPublishing: !!settingsBefore } })
  for (const id of made.stories) await payload.delete({ collection: 'stories', id }).catch(() => {})
  for (const id of made.items) await payload.delete({ collection: 'items', id }).catch(() => {})
  for (const id of made.media) await payload.delete({ collection: 'media', id }).catch(() => {})
  for (const id of made.users) await payload.delete({ collection: 'users', id })
})

describe('stories', () => {
  it('are public only once published, and publish their portrait with them', async () => {
    const pic = await portrait()
    const s = (await payload.create({
      collection: 'stories',
      draft: true,
      data: { title: `Test story ${stamp}`, body: markdownToLexical('A life.') as never, subject: { name: 'Test', portrait: pic }, _status: 'draft' },
      ...staff(editor),
    })) as Story
    made.stories.push(s.id)
    expect(await publicStory(s.id)).toBeUndefined()
    expect((await payload.findByID({ collection: 'media', id: pic, overrideAccess: true })).public).toBe(false)

    await payload.update({ collection: 'stories', id: s.id, data: { _status: 'published' }, ...staff(editor) })
    expect((await publicStory(s.id))?.title).toBe(`Test story ${stamp}`)
    expect((await payload.findByID({ collection: 'media', id: pic, overrideAccess: true })).public).toBe(true)
  })

  it('cannot be written by a contributor', async () => {
    await expect(
      payload.create({ collection: 'stories', data: { title: 'Nope', body: markdownToLexical('x') as never }, ...staff(contributor) }),
    ).rejects.toThrow()
  })

  it('show the public only the checked parts of the documents they cite', async () => {
    const it_ = (await payload.create({
      collection: 'items',
      depth: 0,
      data: { itemId: `ST-${stamp}`, title: 'AI title with a misread name', transcript: 'AI transcript', rights: 'x', _status: 'published' } as Item,
    })) as Item
    made.items.push(it_.id)
    const s = (await payload.create({
      collection: 'stories',
      data: { title: `Story with a document ${stamp}`, body: markdownToLexical('x') as never, documents: [it_.id], _status: 'published' },
      overrideAccess: true,
    })) as Story
    made.stories.push(s.id)
    const doc = (await publicStory(s.id))?.documents?.[0] as Item
    expect(doc.title).toBe(`ST-${stamp} · Archival item`)
    expect(doc.transcript).toBeNull()
  })
})
