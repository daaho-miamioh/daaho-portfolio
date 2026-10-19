import crypto from 'crypto'
import { APIError, type PayloadRequest } from 'payload'

import { ROLES, type Role } from '@/access/roles'
import { emailConfigured } from '@/lib/email'

export const INVITE_DAYS = 3
const INVITE_MS = INVITE_DAYS * 24 * 60 * 60 * 1000

/**
 * The address links in emails point to. Taken from SITE_URL (comma-separated; the first is the
 * default), or on Vercel its production address; never trusted from the request alone: a forged Host header on a password-reset request
 * would otherwise send someone a link to another site, carrying their reset token.
 */
export function siteOrigin(req: PayloadRequest): string {
  const allowed = (process.env.SITE_URL || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  // On Vercel, its own production address (set by Vercel, not by the request) is a safe default.
  if (!allowed.length && process.env.VERCEL_PROJECT_PRODUCTION_URL) allowed.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const fromRequest = req.headers.get('origin') || (host ? `${proto}://${host}` : '')
  if (allowed.includes(fromRequest)) return fromRequest
  if (allowed.length) return allowed[0]
  if (process.env.NODE_ENV !== 'production' && fromRequest) return fromRequest
  throw new APIError('SITE_URL is not set, so the site cannot write links into emails.', 500)
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label.split(' — ')[0] ?? role

export function invitationEmail(o: { name: string; inviter: string; role: string; link: string; expires: Date }) {
  const until = o.expires.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/New_York' })
  const subject = 'You are invited to the DAAHO project site'
  const text = [
    `Hi ${o.name},`,
    '',
    `${o.inviter} has invited you to work on Documenting Asian American Histories in Ohio (DAAHO) as ${roleLabel(o.role)}.`,
    '',
    'Choose your password here to activate your account:',
    o.link,
    '',
    `This link works once and expires on ${until} (Eastern time). If it has expired, ask ${o.inviter} to send a new one.`,
    '',
    'If you were not expecting this, you can ignore this email.',
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0a0a0a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e5e5e5;border-radius:14px">
<tr><td style="padding:32px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#525252">DAAHO · Miami University Libraries</p>
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3">You are invited to the DAAHO project site</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi ${escape(o.name)},</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6">${escape(o.inviter)} has invited you to work on <strong>Documenting Asian American Histories in Ohio</strong> as <strong>${escape(roleLabel(o.role))}</strong>. Choose your password to activate your account.</p>
<p style="margin:0 0 24px"><a href="${escape(o.link)}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Choose your password</a></p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#525252">This link works once and expires on <strong>${escape(until)}</strong> (Eastern time). If it has expired, ask ${escape(o.inviter)} to send a new one.</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#525252">If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${escape(o.link)}</span></p>
<p style="margin:16px 0 0;font-size:13px;color:#525252">If you were not expecting this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`
  return { subject, text, html }
}

export type InviteResult = { id: number; email: string; link: string; expiresAt: string; emailed: boolean; emailError?: string }

/**
 * Give a user a link to choose their password, valid for INVITE_DAYS, and email it if the site can
 * send email. The link is also returned so an admin can send it by hand if the email does not arrive.
 * A new invitation replaces any earlier link.
 */
export async function sendInvitation(req: PayloadRequest, userId: number): Promise<InviteResult> {
  const user = await req.payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true, req })
  const result = await req.payload.forgotPassword({
    collection: 'users',
    data: { email: user.email },
    disableEmail: true,
    expiration: INVITE_MS,
    req,
  })
  const token = typeof result === 'string' ? result : (result as { token?: string } | null)?.token
  if (!token) throw new APIError('Could not create an invitation link.', 500)
  const expires = new Date(Date.now() + INVITE_MS)
  const link = `${siteOrigin(req)}/admin/reset/${token}`
  await req.payload.update({
    collection: 'users',
    id: userId,
    data: { invitedAt: new Date().toISOString(), invitedBy: req.user?.id ?? null },
    overrideAccess: true,
    req,
  })

  let emailed = false
  let emailError: string | undefined
  if (emailConfigured()) {
    const inviter = (req.user as { name?: string } | null)?.name || 'The DAAHO project team'
    const mail = invitationEmail({ name: user.name, inviter, role: user.role, link, expires })
    try {
      await req.payload.sendEmail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text })
      emailed = true
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'The email could not be sent.'
      req.payload.logger.error({ err, msg: `Invitation email to user ${userId} failed` })
    }
  }
  return { id: userId, email: user.email, link, expiresAt: expires.toISOString(), emailed, emailError }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Create an account with no usable password and invite its owner to choose one. */
export async function inviteNewUser(req: PayloadRequest, input: { name?: unknown; email?: unknown; role?: unknown }) {
  const name = String(input.name ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const role = String(input.role ?? 'contributor') as Role
  if (!name) throw new APIError('Enter a name.', 400)
  if (!EMAIL.test(email)) throw new APIError('Enter a valid email address.', 400)
  if (!ROLES.some((r) => r.value === role)) throw new APIError('Choose a role.', 400)
  const existing = await req.payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, req })
  if (existing.docs[0]) {
    throw new APIError(`${email} already has an account. Open it under Users to send a new invitation.`, 409)
  }
  // Payload requires a password; this one is random, never shown or stored anywhere readable, and is
  // replaced when the person chooses their own.
  const user = await req.payload.create({
    collection: 'users',
    data: { name, email, role, password: crypto.randomBytes(32).toString('base64url') },
    overrideAccess: true,
    req,
  })
  return sendInvitation(req, user.id)
}
