import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Item, User } from '@/payload-types'

/** Who verified a translation, and when it stops being verified. Throwaway records, removed afterwards. */
let payload: Payload
const stamp = Date.now()
const made = { users: [] as number[], items: [] as number[] }
let editor: User
let contributor: User

async function user(role: 'admin' | 'editor' | 'contributor') {
  const doc = await payload.create({ collection: 'users', data: { email: `${role}-t${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role } })
  made.users.push(doc.id)
  return doc as User
}
async function item(translation: Item['translation']) {
  const doc = await payload.create({
    collection: 'items',
    draft: true,
    depth: 0,
    data: { itemId: `T-${stamp}-${made.items.length}`, title: '家书', transcript: '[page 1]\n親愛的母親：', language: 'Chinese', translation, _status: 'draft' },
  })
  made.items.push(doc.id)
  return doc as Item
}
const save = (id: number, data: Partial<Item>, as?: User) =>
  payload.update({ collection: 'items', id, draft: true, depth: 0, data, ...(as ? { user: as, overrideAccess: false } : {}) }) as Promise<Item>

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await user('admin')
  editor = await user('editor')
  contributor = await user('contributor')
})

afterAll(async () => {
  for (const id of made.items) await payload.delete({ collection: 'items', id }).catch(() => {})
  for (const id of made.users) await payload.delete({ collection: 'users', id })
})

describe('translations', () => {
  it('start as unverified AI translations', async () => {
    const it_ = await item({ text: '[page 1]\nDear Mother,', model: 'Claude Opus 5.5' })
    expect(it_.translation?.status).toBe('ai')
    expect(it_.translation?.verifiedBy).toBeFalsy()
  })

  it('record who verified one, and when', async () => {
    const it_ = await item({ text: '[page 1]\nDear Mother,' })
    const v = await save(it_.id, { translation: { ...it_.translation, status: 'verified' } }, contributor)
    expect(v.translation?.verifiedBy).toBe(contributor.id)
    expect(v.translation?.verifiedAt).toBeTruthy()
  })

  it('keep the verifier when something else on the item changes', async () => {
    const it_ = await item({ text: '[page 1]\nDear Mother,' })
    await save(it_.id, { translation: { ...it_.translation, status: 'verified' } }, contributor)
    const later = await save(it_.id, { title: '家書 (letter home)' }, editor)
    expect(later.translation?.status).toBe('verified')
    expect(later.translation?.verifiedBy).toBe(contributor.id)
  })

  it('make whoever edits a verified translation its verifier', async () => {
    const it_ = await item({ text: '[page 1]\nDear Mother,' })
    const v = await save(it_.id, { translation: { ...it_.translation, status: 'verified' } }, contributor)
    const edited = await save(it_.id, { translation: { ...v.translation, text: '[page 1]\nMy dear mother,' } }, editor)
    expect(edited.translation?.status).toBe('verified')
    expect(edited.translation?.verifiedBy).toBe(editor.id)
  })

  it('go back to unverified when a script replaces the text', async () => {
    const it_ = await item({ text: '[page 1]\nDear Mother,' })
    const v = await save(it_.id, { translation: { ...it_.translation, status: 'verified' } }, contributor)
    const replaced = await save(it_.id, { translation: { ...v.translation, text: '[page 1]\nDearest Mother,' } })
    expect(replaced.translation?.status).toBe('ai')
    expect(replaced.translation?.verifiedBy).toBeFalsy()
  })

  it('carry no verifier for a translation made by staff', async () => {
    const it_ = await item({ text: '[page 1]\nDear Mother,', status: 'human', translator: 'Meng Qu' })
    expect(it_.translation?.verifiedBy).toBeFalsy()
    expect(it_.translation?.translator).toBe('Meng Qu')
  })

  it('are found by the public search', async () => {
    const it_ = await item({ text: `[page 1]\nDear Mother, the plum blossoms ${stamp}` })
    const found = await payload.find({ collection: 'items', draft: true, where: { 'translation.text': { like: `blossoms ${stamp}` } } })
    expect(found.docs.map((d) => d.id)).toContain(it_.id)
  })
})
