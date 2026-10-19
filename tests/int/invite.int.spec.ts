import config from '@/payload.config'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Users } from '@/collections/Users'
import { INVITE_DAYS, inviteNewUser, sendInvitation, siteOrigin } from '@/lib/invite'
import type { User } from '@/payload-types'

/** Invitations: an admin creates an account, the person chooses their own password. */
let payload: Payload
const stamp = Date.now()
const made: number[] = []
let admin: User
let editor: User
const SITE = 'https://daaho.test'

async function user(role: 'admin' | 'editor' | 'contributor') {
  const doc = await payload.create({ collection: 'users', data: { email: `${role}-i${stamp}@test.invalid`, password: `pw-${stamp}-${role}`, name: `Test ${role}`, role } })
  made.push(doc.id)
  return doc as User
}
const reqAs = async (u: User, headers: Record<string, string> = {}) => {
  const req = (await createLocalReq({ user: { ...u, collection: 'users' } as never }, payload)) as PayloadRequest
  for (const [k, v] of Object.entries(headers)) req.headers.set(k, v)
  return req
}
const tokenOf = (link: string) => link.split('/admin/reset/')[1]
const hidden = (id: number) => payload.findByID({ collection: 'users', id, depth: 0, showHiddenFields: true, overrideAccess: true }) as Promise<User & { resetPasswordToken?: string; resetPasswordExpiration?: string }>

beforeAll(async () => {
  process.env.SITE_URL = SITE
  payload = await getPayload({ config: await config })
  admin = await user('admin')
  editor = await user('editor')
})

afterAll(async () => {
  for (const id of made) await payload.delete({ collection: 'users', id }).catch(() => {})
})

describe('invitations', () => {
  it('create the account with the chosen role and a three-day link that sets the password', async () => {
    const email = `student-${stamp}@test.invalid`
    const r = await inviteNewUser(await reqAs(admin), { name: 'Test Student', email, role: 'contributor' })
    made.push(r.id)
    expect(r.link.startsWith(`${SITE}/admin/reset/`)).toBe(true)
    expect(r.emailed).toBe(false) // no email settings in tests

    const stored = await hidden(r.id)
    expect(stored.role).toBe('contributor')
    expect(stored.invitedBy).toBe(admin.id)
    expect(stored.invitedAt).toBeTruthy()
    const days = (new Date(stored.resetPasswordExpiration!).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(INVITE_DAYS - 0.01)
    expect(days).toBeLessThanOrEqual(INVITE_DAYS)

    await payload.resetPassword({ collection: 'users', data: { token: tokenOf(r.link), password: 'chosen-by-them-123' }, overrideAccess: true })
    const login = await payload.login({ collection: 'users', data: { email, password: 'chosen-by-them-123' } })
    expect(login.user?.id).toBe(r.id)
  })

  it('replace the earlier link when sent again', async () => {
    const r1 = await inviteNewUser(await reqAs(admin), { name: 'Test PI', email: `pi-${stamp}@test.invalid`, role: 'editor' })
    made.push(r1.id)
    const r2 = await sendInvitation(await reqAs(admin), r1.id)
    expect(tokenOf(r2.link)).not.toBe(tokenOf(r1.link))
    await expect(
      payload.resetPassword({ collection: 'users', data: { token: tokenOf(r1.link), password: 'x-123456789' }, overrideAccess: true }),
    ).rejects.toThrow()
  })

  it('refuse an email that already has an account, and bad input', async () => {
    const req = await reqAs(admin)
    await expect(inviteNewUser(req, { name: 'Dup', email: editor.email, role: 'contributor' })).rejects.toThrow(/already has an account/)
    await expect(inviteNewUser(req, { name: 'X', email: 'not-an-email', role: 'contributor' })).rejects.toThrow(/valid email/)
    await expect(inviteNewUser(req, { name: 'X', email: `x-${stamp}@test.invalid`, role: 'owner' })).rejects.toThrow(/role/)
  })

  it('are refused to anyone but an admin', async () => {
    const endpoint = (Users.endpoints || []).find((e) => e.path === '/invite')
    if (!endpoint) throw new Error('invite endpoint missing')
    const res = (await endpoint.handler(await reqAs(editor))) as Response
    expect(res.status).toBe(403)
  })

  it('cannot be faked by a user editing their own record', async () => {
    const self = await user('contributor')
    const after = await payload.update({
      collection: 'users',
      id: self.id,
      data: { invitedAt: '2020-01-01T00:00:00.000Z', name: 'Renamed' } as Partial<User>,
      user: { ...self, collection: 'users' } as never,
      overrideAccess: false,
      depth: 0,
    })
    expect(after.name).toBe('Renamed')
    expect(after.invitedAt).toBeFalsy()
  })

  it('never put a forged host into an email link', async () => {
    expect(siteOrigin(await reqAs(admin, { host: 'evil.example', 'x-forwarded-proto': 'https' }))).toBe(SITE)
    expect(siteOrigin(await reqAs(admin, { origin: SITE }))).toBe(SITE)
  })

  it('fall back to Vercel\'s own production address, not the request, when SITE_URL is unset', async () => {
    const saved = { site: process.env.SITE_URL, vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL }
    delete process.env.SITE_URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'daaho.vercel.app'
    try {
      expect(siteOrigin(await reqAs(admin, { host: 'evil.example' }))).toBe('https://daaho.vercel.app')
    } finally {
      process.env.SITE_URL = saved.site
      if (saved.vercel === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL
      else process.env.VERCEL_PROJECT_PRODUCTION_URL = saved.vercel
    }
  })
})
