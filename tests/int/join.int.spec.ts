import config from '@/payload.config'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AccessRequests } from '@/collections/AccessRequests'
import { applyToJoin, approveRequest, declineRequest } from '@/lib/join'
import type { User } from '@/payload-types'

/** Asking to join: anyone may ask on /join; only an admin's approval creates an account. */
let payload: Payload
const stamp = Date.now()
const users: number[] = []
let admin: User
let editor: User
let acceptedBefore: boolean | null | undefined

const application = (tag: string, more: Record<string, unknown> = {}) => ({
  name: `Applicant ${tag}`,
  email: `apply-${tag}-${stamp}@test.invalid`,
  affiliation: 'Test University',
  kind: 'researcher',
  reason: 'I would like to help review transcripts.',
  ...more,
})

async function user(role: 'admin' | 'editor') {
  const doc = await payload.create({ collection: 'users', data: { email: `${role}-j${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role } })
  users.push(doc.id)
  return doc as User
}
const reqAs = async (u: User | null) =>
  (await createLocalReq(u ? { user: { ...u, collection: 'users' } as never } : {}, payload)) as PayloadRequest
const requestsFor = (email: string) =>
  payload.find({ collection: 'access-requests', where: { email: { equals: email } }, depth: 0, overrideAccess: true }).then((r) => r.docs)

beforeAll(async () => {
  process.env.SITE_URL = 'https://daaho.test'
  payload = await getPayload({ config: await config })
  admin = await user('admin')
  editor = await user('editor')
  acceptedBefore = (await payload.findGlobal({ slug: 'settings', depth: 0 })).acceptAccessRequests
})

afterAll(async () => {
  await payload.updateGlobal({ slug: 'settings', data: { acceptAccessRequests: acceptedBefore ?? true } })
  await payload.delete({ collection: 'access-requests', where: { email: { like: `-${stamp}@test.invalid` } }, overrideAccess: true })
  const invited = await payload.find({ collection: 'users', where: { email: { like: `apply-` } }, depth: 0, limit: 100 })
  for (const u of invited.docs) if (u.email.endsWith(`-${stamp}@test.invalid`)) users.push(u.id)
  for (const id of users) await payload.delete({ collection: 'users', id }).catch(() => {})
})

describe('asking to join', () => {
  it('keeps a complete request as waiting, open to admins only', async () => {
    const a = application('kept')
    expect(await applyToJoin(await reqAs(null), a)).toEqual({ ok: true })
    const [doc] = await requestsFor(a.email)
    expect(doc).toMatchObject({ name: a.name, kind: 'researcher', status: 'pending' })

    await expect(payload.find({ collection: 'access-requests', overrideAccess: false })).rejects.toThrow()
    const asEditor = payload.findByID({ collection: 'access-requests', id: doc.id, overrideAccess: false, user: { ...editor, collection: 'users' } as never })
    await expect(asEditor).rejects.toThrow()
  })

  it('refuses an incomplete request, naming the fields', async () => {
    await expect(applyToJoin(await reqAs(null), application('bad', { email: 'nope', reason: '' }))).rejects.toMatchObject({
      status: 400,
      data: { fields: { email: expect.any(String), reason: expect.any(String) } },
    })
  })

  it('keeps nothing from a bot that fills in the hidden field, and says nothing different', async () => {
    const a = application('bot', { website: 'http://spam.example' })
    expect(await applyToJoin(await reqAs(null), a)).toEqual({ ok: true })
    expect(await requestsFor(a.email)).toHaveLength(0)
  })

  it('keeps one waiting request per address', async () => {
    const a = application('twice')
    await applyToJoin(await reqAs(null), a)
    await applyToJoin(await reqAs(null), { ...a, reason: 'Again' })
    expect(await requestsFor(a.email)).toHaveLength(1)
  })

  it('cannot be set to approved by whoever sends it', async () => {
    const a = application('sneaky', { status: 'approved' })
    await applyToJoin(await reqAs(null), a)
    expect((await requestsFor(a.email))[0].status).toBe('pending')
  })

  it('is refused while Site settings close the form', async () => {
    await payload.updateGlobal({ slug: 'settings', data: { acceptAccessRequests: false } })
    try {
      await expect(applyToJoin(await reqAs(null), application('closed'))).rejects.toMatchObject({ status: 403 })
    } finally {
      await payload.updateGlobal({ slug: 'settings', data: { acceptAccessRequests: true } })
    }
  })
})

describe('deciding on a request', () => {
  it('approving creates the account with the chosen role and an invitation, once', async () => {
    const a = application('approve')
    await applyToJoin(await reqAs(null), a)
    const [doc] = await requestsFor(a.email)
    const result = await approveRequest(await reqAs(admin), doc.id, 'contributor')
    expect(result.link).toContain('/admin/reset/')
    users.push(result.id)

    const account = await payload.findByID({ collection: 'users', id: result.id, depth: 0 })
    expect(account).toMatchObject({ email: a.email, name: a.name, role: 'contributor', invitedBy: admin.id })
    const after = await payload.findByID({ collection: 'access-requests', id: doc.id, depth: 0, overrideAccess: true })
    expect(after).toMatchObject({ status: 'approved', account: result.id, decidedBy: admin.id })
    await expect(approveRequest(await reqAs(admin), doc.id, 'contributor')).rejects.toMatchObject({ status: 409 })
  })

  it('declining closes the request without an account', async () => {
    const a = application('decline')
    await applyToJoin(await reqAs(null), a)
    const [doc] = await requestsFor(a.email)
    expect(await declineRequest(await reqAs(admin), doc.id, true)).toEqual({ emailed: false }) // no email settings in tests
    const after = await payload.findByID({ collection: 'access-requests', id: doc.id, depth: 0, overrideAccess: true })
    expect(after.status).toBe('declined')
    const accounts = await payload.find({ collection: 'users', where: { email: { equals: a.email } }, depth: 0 })
    expect(accounts.totalDocs).toBe(0)
  })

  it('is refused to anyone but an admin', async () => {
    const a = application('refused')
    await applyToJoin(await reqAs(null), a)
    const [doc] = await requestsFor(a.email)
    for (const path of ['/:id/approve', '/:id/decline']) {
      const endpoint = AccessRequests.endpoints && AccessRequests.endpoints.find((e) => e.path === path)
      if (!endpoint) throw new Error(`${path} endpoint missing`)
      const req = await reqAs(editor)
      req.routeParams = { id: String(doc.id) }
      expect(((await endpoint.handler(req)) as Response).status).toBe(403)
    }
    expect((await requestsFor(a.email))[0].status).toBe('pending')
  })
})
