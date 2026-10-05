import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { markNotDuplicates, mergePeople } from '@/lib/mergePeople'
import type { Item, Person, User } from '@/payload-types'

/** Merging duplicate people, against a real database. Throwaway records only, removed afterwards. */
let payload: Payload
const stamp = Date.now()
const made = { users: [] as number[], people: [] as number[], items: [] as number[] }
let editor: User
let contributor: User

async function user(role: 'admin' | 'editor' | 'contributor') {
  const doc = await payload.create({
    collection: 'users',
    data: { email: `${role}-m${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role },
  })
  made.users.push(doc.id)
  return doc as User
}
async function person(name: string, extra: Partial<Person> = {}) {
  const doc = await payload.create({
    collection: 'people',
    data: { name: `${name} ${stamp}`, kind: 'person', importKey: `${name.toLowerCase()}-${stamp}`, _status: 'published', ...extra },
  })
  made.people.push(doc.id)
  return doc as Person
}
async function item(people: { person: number; role: 'creator' | 'correspondent' | 'contributor' }[], extra: Record<string, unknown> = {}) {
  const doc = await payload.create({
    collection: 'items',
    draft: true,
    data: { itemId: `M-${stamp}-${made.items.length}`, title: 'Merge test', people, _status: 'draft', ...extra },
  })
  made.items.push(doc.id)
  return doc as Item
}
const reload = (id: number) => payload.findByID({ collection: 'items', id, draft: true, depth: 0 }) as Promise<Item>
const exists = (id: number) => payload.find({ collection: 'people', where: { id: { equals: id } }, draft: true }).then((r) => r.totalDocs === 1)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await user('admin') // an empty users table promotes the first account; keep the next roles as asked
  editor = await user('editor')
  contributor = await user('contributor')
})

afterAll(async () => {
  for (const id of made.items) await payload.delete({ collection: 'items', id }).catch(() => {})
  for (const id of made.people) await payload.delete({ collection: 'people', id }).catch(() => {})
  for (const id of made.users) await payload.delete({ collection: 'users', id })
})

describe('mergePeople', () => {
  it('repoints items, keeps one row per person with the strongest role, and folds the records together', async () => {
    const full = await person('Upham, Alfred H.', { aliases: [{ value: 'Alfred H. Upham' }] })
    const initials = await person('Upham, A. H.', { aliases: [{ value: 'Upham, A.H.' }] })
    const third = await person('Upham, Mrs.', { possibleDuplicates: [initials.id] })
    await payload.update({ collection: 'people', id: full.id, data: { possibleDuplicates: [initials.id, third.id] } })

    const both = await item([{ person: initials.id, role: 'creator' }, { person: full.id, role: 'correspondent' }])
    const onlyInitials = await item([{ person: initials.id, role: 'contributor' }])

    const result = await mergePeople(payload, editor, full.id, [initials.id])
    expect(result.itemsUpdated).toBe(2)

    expect((await reload(both.id)).people).toEqual([expect.objectContaining({ person: full.id, role: 'creator' })])
    expect((await reload(onlyInitials.id)).people).toEqual([expect.objectContaining({ person: full.id, role: 'contributor' })])

    const survivor = (await payload.findByID({ collection: 'people', id: full.id, depth: 0, draft: true })) as Person
    expect(survivor.aliases?.map((a) => a.value)).toEqual(
      expect.arrayContaining(['Alfred H. Upham', `Upham, A. H. ${stamp}`, 'Upham, A.H.']),
    )
    expect(survivor.mergedFrom?.[0]).toMatchObject({ name: `Upham, A. H. ${stamp}`, importKey: `upham, a. h.-${stamp}` })
    expect(survivor.possibleDuplicates).toEqual([third.id])
    expect(await exists(initials.id)).toBe(false)

    // Whoever listed the merged record now lists the survivor.
    const t = (await payload.findByID({ collection: 'people', id: third.id, depth: 0, draft: true })) as Person
    expect(t.possibleDuplicates).toEqual([full.id])
  })

  it('maps a merged import key to the survivor', async () => {
    const keep = await person('Keep')
    const gone = await person('Gone')
    await mergePeople(payload, editor, keep.id, [gone.id])
    const found = await payload.find({ collection: 'people', where: { 'mergedFrom.importKey': { equals: `gone-${stamp}` } }, draft: true })
    expect(found.docs.map((d) => d.id)).toEqual([keep.id])
  })

  it('refuses a contributor', async () => {
    const a = await person('ContribA')
    const b = await person('ContribB')
    await expect(mergePeople(payload, contributor, a.id, [b.id])).rejects.toThrow(/editors and admins/)
    expect(await exists(b.id)).toBe(true)
  })

  it('refuses, before changing anything, when an item has unpublished changes on a published version', async () => {
    const keep = await person('PendKeep')
    const gone = await person('PendGone')
    const draftItem = await item([{ person: gone.id, role: 'creator' }])
    const pub = await item([{ person: gone.id, role: 'creator' }], { review: { status: 'reviewed' }, rights: 'In copyright' })
    await payload.update({ collection: 'items', id: pub.id, data: { _status: 'published' }, user: editor, overrideAccess: false })
    await payload.update({ collection: 'items', id: pub.id, data: { title: 'Edited, not published' }, draft: true, user: editor, overrideAccess: false })

    await expect(mergePeople(payload, editor, keep.id, [gone.id])).rejects.toThrow(/pending changes/)
    expect((await reload(draftItem.id)).people).toEqual([expect.objectContaining({ person: gone.id })])
    expect(await exists(gone.id)).toBe(true)
  })

  it('keeps a draft a draft and a published item published', async () => {
    const keep = await person('StateKeep')
    const gone = await person('StateGone')
    const draftItem = await item([{ person: gone.id, role: 'creator' }])
    const pub = await item([{ person: gone.id, role: 'creator' }], { review: { status: 'reviewed' }, rights: 'In copyright' })
    await payload.update({ collection: 'items', id: pub.id, data: { _status: 'published' }, user: editor, overrideAccess: false })

    await mergePeople(payload, editor, keep.id, [gone.id])
    const main = (id: number) => payload.findByID({ collection: 'items', id, draft: false, depth: 0 }) as Promise<Item>
    expect((await main(draftItem.id))._status).toBe('draft')
    expect((await main(draftItem.id)).people).toEqual([expect.objectContaining({ person: keep.id })])
    expect((await main(pub.id))._status).toBe('published')
    expect((await main(pub.id)).people).toEqual([expect.objectContaining({ person: keep.id })])
  })

  it('rolls the whole merge back when a late step fails', async () => {
    const keep = await person('RollKeep')
    const gone = await person('RollGone')
    const draftItem = await item([{ person: gone.id, role: 'creator' }])
    // Fail the final step, after items and the survivor have already been written.
    const spy = vi.spyOn(payload, 'delete').mockRejectedValueOnce(new Error('simulated failure'))
    try {
      await expect(mergePeople(payload, editor, keep.id, [gone.id])).rejects.toThrow('simulated failure')
    } finally {
      spy.mockRestore()
    }
    expect((await reload(draftItem.id)).people).toEqual([expect.objectContaining({ person: gone.id })])
    expect(await exists(gone.id)).toBe(true)
    const k = (await payload.findByID({ collection: 'people', id: keep.id, depth: 0, draft: true })) as Person
    expect(k.mergedFrom ?? []).toEqual([])
  })
})

describe('markNotDuplicates', () => {
  it('stops proposing two records as the same person', async () => {
    const a = await person('Rama V')
    const b = await person('Rama VI', { possibleDuplicates: [a.id] })
    await payload.update({ collection: 'people', id: a.id, data: { possibleDuplicates: [b.id] } })
    await markNotDuplicates(payload, editor, [a.id, b.id])
    for (const id of [a.id, b.id]) {
      const p = (await payload.findByID({ collection: 'people', id, depth: 0, draft: true })) as Person
      expect(p.possibleDuplicates ?? []).toEqual([])
    }
  })
})
