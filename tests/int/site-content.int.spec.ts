import config from '@/payload.config'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Media, User } from '@/payload-types'

/** Project events and team members: who may edit them, and when their images become public. */
let payload: Payload
const stamp = Date.now()
const made = { users: [] as number[], events: [] as number[], team: [] as number[], media: [] as number[] }
let editor: User
let contributor: User

async function user(role: 'admin' | 'editor' | 'contributor') {
  const doc = await payload.create({ collection: 'users', data: { email: `${role}-s${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role } })
  made.users.push(doc.id)
  return doc as User
}
async function image() {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: 'test image', public: false },
    filePath: path.resolve('tests/fixtures/pixel.png'),
  })
  made.media.push(doc.id)
  return doc as Media
}
const isPublic = async (id: number) => (await payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true })).public
const publicEvents = async (id: number) => (await payload.find({ collection: 'project-events', where: { id: { equals: id } }, overrideAccess: false })).totalDocs

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await user('admin')
  editor = await user('editor')
  contributor = await user('contributor')
})

afterAll(async () => {
  for (const id of made.events) await payload.delete({ collection: 'project-events', id }).catch(() => {})
  for (const id of made.team) await payload.delete({ collection: 'team', id }).catch(() => {})
  for (const id of made.media) await payload.delete({ collection: 'media', id }).catch(() => {})
  for (const id of made.users) await payload.delete({ collection: 'users', id })
})

describe('project events', () => {
  it('stay private as drafts, and make their images public only when published', async () => {
    const img = await image()
    const draft = await payload.create({
      collection: 'project-events',
      user: editor,
      overrideAccess: false,
      draft: true,
      data: { title: `Test talk ${stamp}`, start: '2030-05-01', summary: 'A test.', images: [{ image: img.id }], _status: 'draft' },
    })
    made.events.push(draft.id)
    expect(await publicEvents(draft.id)).toBe(0)
    expect(await isPublic(img.id)).toBe(false)

    await payload.update({ collection: 'project-events', id: draft.id, user: editor, overrideAccess: false, data: { _status: 'published' } })
    expect(await publicEvents(draft.id)).toBe(1)
    expect(await isPublic(img.id)).toBe(true)
  })

  it('refuse impossible dates', async () => {
    await expect(
      payload.create({ collection: 'project-events', user: editor, overrideAccess: false, data: { title: 'Bad date', start: '2025-02-30', summary: 'x', _status: 'published' } }),
    ).rejects.toThrow()
  })

  it('cannot be created by a contributor', async () => {
    await expect(
      payload.create({ collection: 'project-events', user: contributor, overrideAccess: false, data: { title: 'Nope', start: '2030-01-01', summary: 'x' } }),
    ).rejects.toThrow()
  })
})

describe('team', () => {
  it('makes a member’s photo public, and only editors can add members', async () => {
    const img = await image()
    await expect(payload.create({ collection: 'team', user: contributor, overrideAccess: false, data: { name: 'Nope', group: 'partners' } })).rejects.toThrow()
    const m = await payload.create({ collection: 'team', user: editor, overrideAccess: false, data: { name: `Test member ${stamp}`, group: 'committee', photo: img.id } })
    made.team.push(m.id)
    expect(await isPublic(img.id)).toBe(true)
  })
})
