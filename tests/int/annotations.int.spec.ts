import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Annotation, Item, User } from '@/payload-types'

/**
 * The annotation review rule, exercised as real users through access control. Throwaway records only,
 * removed afterwards.
 */
let payload: Payload
const stamp = Date.now()
const made = { users: [] as number[], items: [] as number[], annotations: [] as number[] }
let admin: User
let editor: User
let editor2: User
let contributor: User
let item: Item

const TRANSCRIPT = '[page 1]\nDear Mother,\nWe arrived in Oxford on Tuesday. The Oxford snow is deep.\n[page 2]\nYour son'

async function user(role: 'admin' | 'editor' | 'contributor', tag: string = role) {
  const doc = await payload.create({
    collection: 'users',
    data: { email: `${tag}-a${stamp}@test.invalid`, password: `pw-${stamp}-${tag}`, name: `Test ${tag}`, role },
  })
  made.users.push(doc.id)
  return doc as User
}

async function annotate(as: User, data: Partial<Annotation> = {}) {
  const doc = await payload.create({
    collection: 'annotations',
    user: as,
    overrideAccess: false,
    depth: 0,
    data: { item: item.id, quote: 'Oxford snow', category: 'context', body: 'Winter of 1923.', ...data } as Annotation,
  })
  made.annotations.push(doc.id)
  return doc as Annotation
}

const change = (as: User, id: number, data: Partial<Annotation>) =>
  payload.update({ collection: 'annotations', id, user: as, overrideAccess: false, depth: 0, data }) as Promise<Annotation>

const publicCount = async (id: number) =>
  (await payload.find({ collection: 'annotations', where: { id: { equals: id } }, overrideAccess: false })).totalDocs

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  admin = await user('admin') // an empty users table promotes the first account; keep the next roles as asked
  editor = await user('editor')
  editor2 = await user('editor', 'editor2')
  contributor = await user('contributor')
  item = (await payload.create({
    collection: 'items',
    draft: true,
    data: { itemId: `A-${stamp}`, title: 'Annotation test', transcript: TRANSCRIPT, _status: 'draft' },
  })) as Item
  made.items.push(item.id)
})

afterAll(async () => {
  for (const id of made.annotations) await payload.delete({ collection: 'annotations', id }).catch(() => {})
  for (const id of made.items) await payload.delete({ collection: 'items', id }).catch(() => {})
  for (const id of made.users) await payload.delete({ collection: 'users', id })
})

describe('annotations', () => {
  it('records the author, defaults to awaiting review, and anchors the passage with its context', async () => {
    const a = await annotate(contributor)
    expect(a.status).toBe('submitted')
    expect(a.author).toBe(contributor.id)
    expect(a.lastEditedBy).toBe(contributor.id)
    expect(TRANSCRIPT.slice(a.start!, a.end!)).toBe('Oxford snow')
    expect(a.prefix?.endsWith('The ')).toBe(true)
    expect(a.suffix?.startsWith(' is deep.')).toBe(true)
    expect(await publicCount(a.id)).toBe(0)
  })

  it('cannot be created with someone else named as author', async () => {
    const a = await annotate(contributor, { author: editor.id, lastEditedBy: editor.id })
    expect(a.author).toBe(contributor.id)
    expect(a.lastEditedBy).toBe(contributor.id)
  })

  it('refuses a passage that is not in the transcript', async () => {
    await expect(annotate(contributor, { quote: 'Cincinnati' })).rejects.toThrow(/not found/)
  })

  it('does not let a contributor approve, even someone else’s', async () => {
    const a = await annotate(editor)
    await expect(change(contributor, a.id, { status: 'approved' })).rejects.toThrow()
    expect(await publicCount(a.id)).toBe(0)
  })

  it('does not let an editor approve their own annotation', async () => {
    const a = await annotate(editor)
    await expect(change(editor, a.id, { status: 'approved' })).rejects.toThrow(/someone other/)
    expect(await publicCount(a.id)).toBe(0)
  })

  it('does not let an editor who changed the text approve it', async () => {
    const a = await annotate(contributor)
    await change(editor, a.id, { body: 'Winter of 1923; see the Miami Student, Jan. 1923.' })
    await expect(change(editor, a.id, { status: 'approved' })).rejects.toThrow(/someone other/)
    const ok = await change(editor2, a.id, { status: 'approved' })
    expect(ok.status).toBe('approved')
  })

  it('cannot be self-approved by forging the editor fields in the same request', async () => {
    const a = await annotate(editor)
    await expect(change(editor, a.id, { status: 'approved', author: editor2.id, lastEditedBy: editor2.id })).rejects.toThrow(/someone other/)
  })

  it('becomes public when another editor approves it, with the reviewer recorded', async () => {
    const a = await annotate(contributor)
    const ok = await change(editor, a.id, { status: 'approved' })
    expect(ok.reviewedBy).toBe(editor.id)
    expect(ok.reviewedAt).toBeTruthy()
    expect(await publicCount(a.id)).toBe(1)
  })

  it('goes back to review when an approved annotation’s text changes', async () => {
    const a = await annotate(contributor)
    await change(editor, a.id, { status: 'approved' })
    const edited = await change(admin, a.id, { body: 'Winter of 1923–24.' })
    expect(edited.status).toBe('submitted')
    expect(edited.reviewedBy).toBeFalsy()
    expect(await publicCount(a.id)).toBe(0)
  })

  it('stays approved when an editor changes only the review note', async () => {
    const a = await annotate(contributor)
    await change(editor, a.id, { status: 'approved' })
    const noted = await change(admin, a.id, { reviewNote: 'Checked against the 1923 yearbook.' })
    expect(noted.status).toBe('approved')
  })

  it('keeps a returned annotation private, and resubmits it when its author revises it', async () => {
    const a = await annotate(contributor)
    const returned = await change(editor, a.id, { status: 'rejected', reviewNote: 'Needs a source.' })
    expect(returned.status).toBe('rejected')
    expect(await publicCount(a.id)).toBe(0)
    const revised = await change(contributor, a.id, { body: 'Winter of 1923 (Miami Student, 12 Jan. 1923).' })
    expect(revised.status).toBe('submitted')
  })

  it('does not let a contributor change or delete an annotation once approved', async () => {
    const a = await annotate(contributor)
    await change(editor, a.id, { status: 'approved' })
    await expect(change(contributor, a.id, { body: 'changed' })).rejects.toThrow()
    await expect(payload.delete({ collection: 'annotations', id: a.id, user: contributor, overrideAccess: false })).rejects.toThrow()
  })

  it('is removed with its item', async () => {
    const doomed = (await payload.create({
      collection: 'items',
      draft: true,
      data: { itemId: `A-${stamp}-gone`, title: 'Deleted item', transcript: TRANSCRIPT, _status: 'draft' },
    })) as Item
    const a = await payload.create({
      collection: 'annotations',
      data: { item: doomed.id, quote: 'Oxford snow', category: 'context', body: 'x' } as Annotation,
    })
    await payload.delete({ collection: 'items', id: doomed.id })
    expect((await payload.find({ collection: 'annotations', where: { id: { equals: a.id } } })).totalDocs).toBe(0)
  })

  it('does not let a contributor change another contributor’s annotation', async () => {
    const other = await user('contributor', 'contributor2')
    const a = await annotate(other)
    await expect(change(contributor, a.id, { body: 'changed' })).rejects.toThrow()
  })
})
