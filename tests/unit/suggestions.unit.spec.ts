import { afterEach, describe, expect, it, vi } from 'vitest'

import { recaptchaSiteKey, verifyRecaptcha } from '@/lib/recaptcha'
import { checkSuggestion } from '@/lib/suggestions'

const ok = { item: 7, quote: 'Dear Mr. Huang', start: 0, category: 'person', body: 'Chin-Wu Huang studied at Miami in 1924.' }

describe('a visitor suggestion', () => {
  it('passes when it names a passage, a kind and a note', () => {
    const { data, errors } = checkSuggestion({ ...ok, name: ' Ann ', email: 'ann@example.org' })
    expect(errors).toEqual({})
    expect(data).toMatchObject({ item: 7, category: 'person', name: 'Ann', email: 'ann@example.org' })
  })
  it('names each problem', () => {
    const { errors } = checkSuggestion({ item: 'x', quote: '', category: 'gossip', body: 'hi', email: 'nope' })
    expect(Object.keys(errors).sort()).toEqual(['body', 'category', 'email', 'item', 'quote'])
  })
})

describe('the reCAPTCHA check', () => {
  const env = { ...process.env }
  afterEach(() => {
    process.env = { ...env }
  })
  const google = (success: boolean) => vi.fn(async () => ({ ok: true, json: async () => ({ success }) }))

  it('asks Google with the secret, and believes its answer', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'secret'
    const yes = google(true)
    expect(await verifyRecaptcha('token', '1.2.3.4', yes)).toEqual({ ok: true })
    expect(String((yes.mock.calls[0] as unknown[])[1] && ((yes.mock.calls[0] as unknown[])[1] as RequestInit).body)).toContain('response=token')
    expect(await verifyRecaptcha('token', null, google(false))).toEqual({ ok: false, reason: 'failed' })
    expect(await verifyRecaptcha('', null, google(true))).toEqual({ ok: false, reason: 'missing' })
  })
  it('reads the key names used in Vercel, and the older ones', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY
    delete process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    process.env.recaptcha_site_key = 'site'
    process.env.recaptcha_secret = 'secret'
    expect(recaptchaSiteKey()).toBe('site')
    const yes = google(true)
    expect(await verifyRecaptcha('token', null, yes)).toEqual({ ok: true })
    expect(String(((yes.mock.calls[0] as unknown[])[1] as RequestInit).body)).toContain('secret=secret')
    delete process.env.recaptcha_site_key
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = 'old-site'
    expect(recaptchaSiteKey()).toBe('old-site')
  })
  it('without keys, the live site refuses and a development site lets the form be built', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY
    delete process.env.recaptcha_secret
    vi.stubEnv('NODE_ENV', 'production')
    expect(await verifyRecaptcha('t', null, google(true))).toEqual({ ok: false, reason: 'not-configured' })
    vi.stubEnv('NODE_ENV', 'development')
    expect(await verifyRecaptcha('t', null, google(true))).toEqual({ ok: true })
    vi.unstubAllEnvs()
  })
})
