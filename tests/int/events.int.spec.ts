import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

/** AI-drafted historical context is public only after review, with a source. Throwaway records only. */
let payload: Payload
const stamp = Date.now()
const made = { users: [] as number[], events: [] as number[] }
let editor: User
let contributor: User

async function user(role: 'admin' | 'editor' | 'contributor') {
  const doc = await payload.create({
    collection: 'users',
    data: { email: `${role}-e${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role },
  })
  made.users.push(doc.id)
  return doc as User
}
async function draftEvent(extra: Record<string, unknown> = {}) {
  const doc = await payload.create({
    collection: 'events',
    draft: true,
    data: {
      title: `Test event ${stamp}-${made.events.length}`,
      startDate: '1937-07-07',
      regions: ['China'],
      summary: 'A test event.',
      _status: 'draft',
      ...extra,
    },
  })
  made.events.push(doc.id)
  return doc
}
const publish = (id: number, as: User) =>
  payload.update({ collection: 'events', id, data: { _status: 'published' }, user: as, overrideAccess: false })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await user('admin')
  editor = await user('editor')
  contributor = await user('contributor')
})

afterAll(async () => {
  for (const id of made.events) await payload.delete({ collection: 'events', id }).catch(() => {})
  for (const id of made.users) await payload.delete({ collection: 'users', id })
})

describe('historical context events', () => {
  it('derives the years from the dates', async () => {
    const e = await draftEvent({ endDate: '1945-09-02' })
    expect([e.startYear, e.endYear]).toEqual([1937, 1945])
  })

  it('refuses to publish an AI draft nobody has reviewed', async () => {
    const e = await draftEvent({ sources: [{ citation: 'A reference work' }] })
    await expect(publish(e.id, editor)).rejects.toThrow(/Reviewed/)
  })

  it('refuses to publish a reviewed event with no source', async () => {
    const e = await draftEvent({ review: { status: 'reviewed' } })
    await expect(publish(e.id, editor)).rejects.toThrow(/source/)
  })

  it('does not let a contributor publish', async () => {
    const e = await draftEvent({ review: { status: 'reviewed' }, sources: [{ citation: 'A reference work' }] })
    await expect(publish(e.id, contributor)).rejects.toThrow(/cannot publish/)
  })

  it('publishes a reviewed, sourced event, and only then shows it to the public', async () => {
    const e = await draftEvent({ review: { status: 'reviewed' }, sources: [{ citation: 'A reference work' }] })
    const seen = async () =>
      (await payload.find({ collection: 'events', where: { id: { equals: e.id } }, overrideAccess: false })).totalDocs
    expect(await seen()).toBe(0)
    await publish(e.id, editor)
    expect(await seen()).toBe(1)
  })

  it('rejects a malformed date', async () => {
    await expect(draftEvent({ startDate: 'July 1937' })).rejects.toThrow()
  })
})
