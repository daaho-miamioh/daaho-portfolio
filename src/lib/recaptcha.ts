/**
 * Google reCAPTCHA v2 (the "I'm not a robot" checkbox) for public forms.
 *
 *   NEXT_PUBLIC_RECAPTCHA_SITE_KEY   shown to the browser, renders the checkbox
 *   RECAPTCHA_SECRET_KEY             server only, checks the answer with Google
 *
 * Without a secret key the live site refuses (closed, never open to bots); a development or test
 * database accepts, so the form can be built and tested before keys exist. The checkbox script is
 * loaded only when a visitor opens a form, so Google sees no one who merely reads the site.
 */

export const recaptchaSiteKey = () => process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null

export type Verdict = { ok: true } | { ok: false; reason: 'not-configured' | 'missing' | 'failed' | 'unreachable' }

type Fetch = (url: string, init: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

export async function verifyRecaptcha(token: unknown, ip: string | null, fetchImpl: Fetch = fetch): Promise<Verdict> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) return process.env.NODE_ENV === 'production' ? { ok: false, reason: 'not-configured' } : { ok: true }
  if (typeof token !== 'string' || !token.trim()) return { ok: false, reason: 'missing' }
  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)
  try {
    const res = await fetchImpl('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) return { ok: false, reason: 'unreachable' }
    const answer = (await res.json()) as { success?: boolean }
    return answer.success === true ? { ok: true } : { ok: false, reason: 'failed' }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}
