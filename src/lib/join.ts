import { APIError, type PayloadRequest } from 'payload'

import { ROLES } from '@/access/roles'
import { checkApplication, kindLabel, type RequestKind } from '@/lib/accessRequests'
import { emailConfigured } from '@/lib/email'
import { emailButton, emailPage, escapeHtml, inviteNewUser, type InviteResult, siteOrigin } from '@/lib/invite'

/**
 * Asking to join the project, and an admin's answer. Anyone may ask on the form at /join; nothing is
 * granted until an admin approves, which creates the account and sends the ordinary invitation.
 */

/** Requests the form takes in an hour from everyone together: room for a class signing up, not for a flood. */
export const HOURLY_LIMIT = 30

const P = 'margin:0 0 16px;font-size:16px;line-height:1.6'
const SMALL = 'margin:16px 0 0;font-size:13px;line-height:1.6;color:#525252'

export function requestEmail(o: { name: string; email: string; affiliation: string; kind: string; reason: string; link: string }) {
  const subject = `Request to join DAAHO: ${o.name}`
  const who = [o.email, o.affiliation, kindLabel(o.kind)].filter(Boolean).join(' · ')
  const text = [
    `${o.name} has asked to join the DAAHO project site.`,
    '',
    who,
    '',
    'What they would like to do:',
    o.reason,
    '',
    `Approve or decline the request here: ${o.link}`,
  ].join('\n')
  const html = emailPage(
    'Someone has asked to join the project',
    `<p style="${P}"><strong>${escapeHtml(o.name)}</strong><br><span style="color:#525252">${escapeHtml(who)}</span></p>
<p style="margin:0 0 6px;font-size:14px;color:#525252">What they would like to do:</p>
<p style="${P};white-space:pre-wrap;border-left:3px solid #e5e5e5;padding-left:12px">${escapeHtml(o.reason)}</p>
${emailButton(o.link, 'Approve or decline')}
<p style="${SMALL}">You get this email because you are an admin of the DAAHO project site.</p>`,
  )
  return { subject, text, html }
}

export function declinedEmail(o: { name: string; site: string }) {
  const subject = 'Your request to join DAAHO'
  const text = [
    `Hi ${o.name},`,
    '',
    'Thank you for your interest in Documenting Asian American Histories in Ohio (DAAHO). We are not able to add you to the project site at this time.',
    '',
    `The collection itself is open to everyone at ${o.site}.`,
    '',
    'If you have questions, reply to this email.',
  ].join('\n')
  const html = emailPage(
    'Your request to join DAAHO',
    `<p style="${P}">Hi ${escapeHtml(o.name)},</p>
<p style="${P}">Thank you for your interest in <strong>Documenting Asian American Histories in Ohio</strong>. We are not able to add you to the project site at this time.</p>
<p style="${P}">The collection itself is open to everyone at <a href="${escapeHtml(o.site)}">${escapeHtml(o.site.replace(/^https?:\/\//, ''))}</a>.</p>
<p style="${SMALL}">If you have questions, reply to this email.</p>`,
  )
  return { subject, text, html }
}

/**
 * Record a request from the public form and tell the admins. The answer is the same whether or not the
 * address already has an account or a request waiting, so the form cannot be used to find out who is
 * on the project; an admin sees either case when opening the request.
 */
export async function applyToJoin(req: PayloadRequest, input: Record<string, unknown>): Promise<{ ok: true }> {
  // A field people cannot see; only a bot fills it in. It is told all went well, and nothing is kept.
  if (String(input.website ?? '').trim()) return { ok: true }

  const settings = await req.payload.findGlobal({ slug: 'settings', req, depth: 0, overrideAccess: true })
  if (settings.acceptAccessRequests === false) throw new APIError('Requests to join are closed at the moment.', 403, null, true)

  const { data, errors } = checkApplication(input)
  if (Object.keys(errors).length) throw new APIError('Please check the form.', 400, { fields: errors }, true)

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = await req.payload.count({ collection: 'access-requests', where: { createdAt: { greater_than: hourAgo } }, overrideAccess: true, req })
  if (recent.totalDocs >= HOURLY_LIMIT) {
    throw new APIError('We are receiving a lot of requests right now. Please try again in an hour.', 429, null, true)
  }

  const waiting = await req.payload.find({
    collection: 'access-requests',
    where: { and: [{ email: { equals: data.email } }, { status: { equals: 'pending' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (waiting.docs[0]) return { ok: true }

  const doc = await req.payload.create({ collection: 'access-requests', data: { ...data, kind: data.kind as RequestKind, status: 'pending' }, overrideAccess: true, req })

  if (emailConfigured()) {
    const admins = await req.payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, limit: 50, depth: 0, overrideAccess: true, req })
    const to = admins.docs.map((u) => u.email).filter(Boolean)
    if (to.length) {
      try {
        const mail = requestEmail({ ...data, link: `${siteOrigin(req)}/admin/collections/access-requests/${doc.id}` })
        await req.payload.sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text })
      } catch (err) {
        // The request is kept either way; admins also see it under Access requests.
        req.payload.logger.error({ err, msg: `Email about access request ${doc.id} failed` })
      }
    }
  }
  return { ok: true }
}

async function waitingRequest(req: PayloadRequest, id: number) {
  const request = await req.payload.findByID({ collection: 'access-requests', id, depth: 0, overrideAccess: true, req })
  if (request.status !== 'pending') throw new APIError(`This request was already ${request.status === 'approved' ? 'approved' : 'declined'}.`, 409)
  return request
}

const decided = (req: PayloadRequest) => ({ decidedBy: req.user?.id ?? null, decidedAt: new Date().toISOString() })

/** Approve: create the account with the chosen role and send the invitation, as Invite someone does. */
export async function approveRequest(req: PayloadRequest, id: number, role: string): Promise<InviteResult> {
  const request = await waitingRequest(req, id)
  if (!ROLES.some((r) => r.value === role)) throw new APIError('Choose a role.', 400)
  const result = await inviteNewUser(req, { name: request.name, email: request.email, role })
  await req.payload.update({ collection: 'access-requests', id, data: { status: 'approved', account: result.id, ...decided(req) }, overrideAccess: true, req })
  return result
}

/** Decline, and if the admin chooses, tell the person by email. */
export async function declineRequest(req: PayloadRequest, id: number, notify: boolean): Promise<{ emailed: boolean; emailError?: string }> {
  const request = await waitingRequest(req, id)
  await req.payload.update({ collection: 'access-requests', id, data: { status: 'declined', ...decided(req) }, overrideAccess: true, req })
  if (!notify || !emailConfigured()) return { emailed: false }
  const mail = declinedEmail({ name: request.name, site: siteOrigin(req) })
  try {
    await req.payload.sendEmail({ to: request.email, subject: mail.subject, html: mail.html, text: mail.text })
    return { emailed: true }
  } catch (err) {
    req.payload.logger.error({ err, msg: `Email declining access request ${id} failed` })
    return { emailed: false, emailError: err instanceof Error ? err.message : 'The email could not be sent.' }
  }
}
