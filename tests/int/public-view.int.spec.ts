import config from '@/payload.config'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildItemsWhere } from '@/lib/itemsQuery'
import type { Item, Person, User } from '@/payload-types'

/**
 * AI-drafted parts of an item stay hidden from the public until staff check them, on every path the
 * public can read by: pages, the API, search, date filters, linked people, and items embedded in
 * other documents. Throwaway records only, removed afterwards.
 */
let payload: Payload
const stamp = Date.now()
const made = { users: [] as number[], items: [] as number[], people: [] as number[] }
let editor: User
let settingsBefore: { allowUnreviewedPublishing?: boolean | null; defaultRights?: string | null }
let homeFeaturedBefore: number[]
let unchecked: Item
let checked: Item
let hiddenPerson: Person
let shownPerson: Person
let scan: { id: number }
const SECRET = `zebrafinch${stamp}`

const ALL_CHECKED = { titleChecked: true, descriptionChecked: true, transcriptChecked: true, linksChecked: true }
const asPublic = { overrideAccess: false } as const
const asStaff = () => ({ overrideAccess: false, user: { ...editor, collection: 'users' } as never })

async function person(name: string) {
  const doc = (await payload.create({ collection: 'people', data: { name: `${name} ${stamp}`, kind: 'person', importKey: `${name}-${stamp}`, _status: 'published' } })) as Person
  made.people.push(doc.id)
  return doc
}
async function item(data: Partial<Item>) {
  const doc = (await payload.create({
    collection: 'items',
    depth: 0,
    data: { itemId: `PV-${stamp}-${made.items.length}`, rights: 'Test rights', _status: 'published', ...data } as Item,
  })) as Item
  made.items.push(doc.id)
  return doc
}
const byId = async (id: number, access: object) =>
  (await payload.find({ collection: 'items', where: { id: { equals: id } }, depth: 0, ...access })).docs[0] as Item | undefined

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const s = await payload.findGlobal({ slug: 'settings', depth: 0 })
  settingsBefore = { allowUnreviewedPublishing: s.allowUnreviewedPublishing, defaultRights: s.defaultRights }
  await payload.updateGlobal({ slug: 'settings', data: { allowUnreviewedPublishing: true } })
  const home = await payload.findGlobal({ slug: 'home', depth: 0 })
  homeFeaturedBefore = ((home.featured ?? []) as (number | { id: number })[]).map((f) => (typeof f === 'object' ? f.id : f))

  const u = await payload.create({ collection: 'users', data: { email: `editor-pv${stamp}@test.invalid`, password: `pw-${stamp}`, name: 'Test editor', role: 'editor' } })
  made.users.push(u.id)
  editor = u as User
  hiddenPerson = await person('Hsieh')
  shownPerson = await person('Chuang')

  scan = await payload.create({ collection: 'media', data: { alt: 'placeholder' }, filePath: path.resolve('tests/fixtures/pixel.png') })
  unchecked = await item({
    pages: [{ image: scan.id }],
    title: 'Letter from Ching W. Hwang, 29 October 1923',
    date: '1923-10-29',
    description: 'AI-drafted description',
    transcript: `Dear Sir, ${SECRET}`,
    people: [{ person: hiddenPerson.id, role: 'creator' }],
    archival: { type: 'Text', creator: 'Huang, Chin-Wu' },
  })
  checked = await item({
    title: 'Letter from Chin-Wu Huang, 29 October 1925',
    date: '1925-10-29',
    description: 'Checked description',
    transcript: 'Checked transcript',
    people: [{ person: shownPerson.id, role: 'creator' }],
    review: ALL_CHECKED,
  })
})

afterAll(async () => {
  await payload.updateGlobal({ slug: 'home', data: { featured: homeFeaturedBefore } })
  await payload.updateGlobal({ slug: 'settings', data: { allowUnreviewedPublishing: !!settingsBefore.allowUnreviewedPublishing } })
  for (const id of made.items) await payload.delete({ collection: 'items', id }).catch(() => {})
  for (const id of made.people) await payload.delete({ collection: 'people', id }).catch(() => {})
  if (scan) await payload.delete({ collection: 'media', id: scan.id }).catch(() => {})
  for (const id of made.users) await payload.delete({ collection: 'users', id })
})

describe('the public view of items', () => {
  it('hides unchecked parts from the public but not from staff', async () => {
    const pub = await byId(unchecked.id, asPublic)
    expect(pub?.title).toBe(`${unchecked.itemId} · Text`)
    expect(pub?.date).toBeNull()
    expect(pub?.description).toBeNull()
    expect(pub?.transcript).toBeNull()
    expect(pub?.people).toEqual([])
    expect(pub?.archival?.creator).toBe('Huang, Chin-Wu') // the library's record stays public

    const staff = await byId(unchecked.id, asStaff())
    expect(staff?.title).toBe('Letter from Ching W. Hwang, 29 October 1923')
    expect(staff?.transcript).toContain(SECRET)
  })

  it('shows checked parts to the public', async () => {
    const pub = await byId(checked.id, asPublic)
    expect(pub?.title).toBe('Letter from Chin-Wu Huang, 29 October 1925')
    expect(pub?.transcript).toBe('Checked transcript')
    expect(pub?.people?.length).toBe(1)
  })

  it('never lets a public search find a word in a hidden transcript', async () => {
    const where = (publicView: boolean) => buildItemsWhere({ q: SECRET }, {}, publicView)
    const pub = await payload.find({ collection: 'items', where: where(true), depth: 0, ...asPublic })
    expect(pub.docs.map((d) => d.id)).not.toContain(unchecked.id)
    const staff = await payload.find({ collection: 'items', where: where(false), depth: 0, ...asStaff() })
    expect(staff.docs.map((d) => d.id)).toContain(unchecked.id)
  })

  it('files items under a decade for the public only by a checked date', async () => {
    const in1920s = async (publicView: boolean) =>
      (await payload.find({ collection: 'items', where: buildItemsWhere({ decade: '1920s' }, {}, publicView), pagination: false, depth: 0, ...asPublic })).docs.map((d) => d.id)
    const pub = await in1920s(true)
    expect(pub).toContain(checked.id)
    expect(pub).not.toContain(unchecked.id)
  })

  it('keeps names the AI found private until the item is checked', async () => {
    const reload = (id: number) => payload.findByID({ collection: 'people', id, depth: 0, overrideAccess: true }) as Promise<Person>
    expect((await reload(hiddenPerson.id)).public).toBe(false)
    expect((await reload(shownPerson.id)).public).toBe(true)
    const pubPeople = await payload.find({ collection: 'people', where: { id: { in: [hiddenPerson.id, shownPerson.id] } }, depth: 0, ...asPublic })
    expect(pubPeople.docs.map((d) => d.id)).toEqual([shownPerson.id])

    await payload.update({ collection: 'items', id: unchecked.id, data: { review: { linksChecked: true } }, depth: 0 })
    expect((await reload(hiddenPerson.id)).public).toBe(true)
    await payload.update({ collection: 'items', id: unchecked.id, data: { review: { linksChecked: false } }, depth: 0 })
    expect((await reload(hiddenPerson.id)).public).toBe(false)
  })

  it('hides unchecked parts of items embedded in other documents too', async () => {
    await payload.updateGlobal({ slug: 'home', data: { featured: [unchecked.id] } })
    const home = await payload.findGlobal({ slug: 'home', depth: 2, overrideAccess: false })
    const featured = (home.featured ?? [])[0] as Item
    expect(featured.transcript).toBeNull()
    expect(featured.title).toBe(`${unchecked.itemId} · Text`)
  })

  it('names a scan by its item ID, never by an unchecked AI title', async () => {
    const media = await payload.findByID({ collection: 'media', id: scan.id, depth: 0, overrideAccess: false })
    expect(media.alt).toBe(`Page 1 of ${unchecked.itemId}`)
    expect(media.alt).not.toContain('Hwang')
  })

  it('leaves the stored record whole when a script (no signed-in user) updates it', async () => {
    await payload.update({ collection: 'items', id: unchecked.id, data: { language: 'English' }, depth: 0 })
    const stored = (await payload.findByID({ collection: 'items', id: unchecked.id, depth: 0, overrideAccess: true })) as Item
    expect(stored.transcript).toContain(SECRET)
    expect(stored.title).toBe('Letter from Ching W. Hwang, 29 October 1923')
    expect(stored.description).toBe('AI-drafted description')
    expect(stored.people?.length).toBe(1)
  })

  it('records who checked a part, and derives the overall status', async () => {
    const updated = (await payload.update({
      collection: 'items',
      id: unchecked.id,
      data: { review: { titleChecked: true } },
      depth: 0,
      ...asStaff(),
    })) as Item
    expect(updated.review?.reviewedBy).toBe(editor.id)
    expect(updated.review?.status).toBe('in_review')
    expect(updated.publicDateSort).toBeTruthy()
  })
})
