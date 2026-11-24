import { createHash } from 'node:crypto'

import { APIError, type PayloadRequest } from 'payload'

import { ANNOTATION_CATEGORIES } from '@/lib/annotationCategories'
import { locate } from '@/lib/anchors'
import { emailConfigured } from '@/lib/email'
import { emailButton, emailPage, escapeHtml, siteOrigin } from '@/lib/invite'
import { verifyRecaptcha } from '@/lib/recaptcha'

/**
 * Annotations suggested by visitors: a passage of a public transcript and a note on it. They arrive
 * as "submitted" and are public only once an editor approves them (the collection's review rule).
 */

export const SUGGESTION_LIMITS = { quote: 1500, body: 2000, name: 100, email: 200, perHour: 5, perDay: 20 }
const VISITOR_CATEGORIES = ANNOTATION_CATEGORIES.map((c) => c.value) as string[]

type Input = Record<string, unknown>
export type Suggestion = {
  item: number
  quote: string
  start: number | null
  category: string
  body: string
  name: string | null
  email: string | null
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Check what a visitor sent. Returns the cleaned suggestion, or the problems field by field. */
export function checkSuggestion(input: Input): { data: Suggestion; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const item = Number(input.item)
  if (!Number.isInteger(item) || item <= 0) errors.item = 'Unknown item.'
  const quote = str(input.quote)
  if (!quote.trim()) errors.quote = 'Select the passage your note is about.'
  else if (quote.length > SUGGESTION_LIMITS.quote) errors.quote = `Select a shorter passage (up to ${SUGGESTION_LIMITS.quote} characters).`
  const start = Number.isInteger(Number(input.start)) && Number(input.start) >= 0 ? Number(input.start) : null
  const category = str(input.category) || 'context'
  if (!VISITOR_CATEGORIES.includes(category)) errors.category = 'Choose what kind of note this is.'
  const body = str(input.body).trim()
  if (body.length < 5) errors.body = 'Write your note.'
  else if (body.length > SUGGESTION_LIMITS.body) errors.body = `Keep the note under ${SUGGESTION_LIMITS.body} characters.`
  const name = str(input.name).trim().slice(0, SUGGESTION_LIMITS.name) || null
  const email = str(input.email).trim() || null
  if (email && (email.length > SUGGESTION_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.email = 'Check the email address, or leave it empty.'
  return { data: { item, quote, start, category, body, name, email }, errors }
}

/**
 * Who hears of a new visitor suggestion: the project's shared mailbox, unless SUGGESTION_NOTICE_TO
 * names another address. Notes written by staff send nothing.
 */
export const suggestionNoticeTo = () => process.env.SUGGESTION_NOTICE_TO?.trim() || 'daaho@miamioh.edu'

const P = 'margin:0 0 16px;font-size:16px;line-height:1.6'
const SMALL = 'margin:16px 0 0;font-size:13px;line-height:1.6;color:#525252'
const QUOTE = 'white-space:pre-wrap;border-left:3px solid #e5e5e5;padding-left:12px'

/**
 * The notice of a new suggestion. It leaves out the visitor's name and email: the mailbox is shared,
 * and those are for staff signed in to the site, where the suggestion itself is.
 */
export function suggestionEmail(o: { itemId: string; title: string; category: string; quote: string; body: string; itemLink: string; reviewLink: string }) {
  const kind = ANNOTATION_CATEGORIES.find((c) => c.value === o.category)?.label ?? o.category
  const subject = `New visitor note on ${o.itemId}`
  const text = [
    `A visitor suggested a note on ${o.itemId}, "${o.title}".`,
    '',
    `Kind of note: ${kind}`,
    '',
    'The passage:',
    o.quote,
    '',
    'Their note:',
    o.body,
    '',
    `Review it (approve or decline): ${o.reviewLink}`,
    `The item: ${o.itemLink}`,
    '',
    "It is not public until an editor approves it. The visitor's name and email, if they gave them, are on the site for signed-in staff.",
  ].join('\n')
  const html = emailPage(
    'A visitor suggested a note',
    `<p style="${P}"><strong>${escapeHtml(o.itemId)}</strong> · <a href="${escapeHtml(o.itemLink)}">${escapeHtml(o.title)}</a><br><span style="color:#525252">Kind of note: ${escapeHtml(kind)}</span></p>
<p style="margin:0 0 6px;font-size:14px;color:#525252">The passage:</p>
<p style="${P};${QUOTE}">${escapeHtml(o.quote)}</p>
<p style="margin:0 0 6px;font-size:14px;color:#525252">Their note:</p>
<p style="${P};${QUOTE}">${escapeHtml(o.body)}</p>
${emailButton(o.reviewLink, 'Approve or decline')}
<p style="${SMALL}">It is not public until an editor approves it. The visitor&rsquo;s name and email, if they gave them, are on the site for signed-in staff. This mailbox gets these notices from the DAAHO project site.</p>`,
  )
  return { subject, text, html }
}

/** A visitor's address, salted and hashed: enough to limit how often one source sends, nothing more. */
export function visitorHash(req: PayloadRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('x-real-ip') || null
  return ip ? createHash('sha256').update(`${ip}:${process.env.PAYLOAD_SECRET ?? ''}`).digest('hex').slice(0, 32) : null
}

export async function suggestAnnotation(
  req: PayloadRequest,
  input: Input,
  verify: typeof verifyRecaptcha = verifyRecaptcha,
): Promise<{ ok: true }> {
  // A field people cannot see; only a bot fills it in. It is told all went well, and nothing is kept.
  if (str(input.website).trim()) return { ok: true }

  const { data, errors } = checkSuggestion(input)
  if (Object.keys(errors).length) throw new APIError('Please check the form.', 400, { fields: errors }, true)

  // Staff signed in to the site need no checkbox; everyone else proves they are a person.
  if (!req.user) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const verdict = await verify(input.recaptcha, ip)
    if (!verdict.ok) {
      const message =
        verdict.reason === 'not-configured'
          ? 'Suggestions are not open yet.'
          : verdict.reason === 'unreachable'
            ? 'We could not check the "I\'m not a robot" box. Please try again.'
            : 'Please tick "I\'m not a robot" and try again.'
      throw new APIError(message, verdict.reason === 'not-configured' ? 503 : 400, null, true)
    }
  }

  // Only a passage the public can see: the item must be published and its transcript public.
  const item = await req.payload
    .findByID({ collection: 'items', id: data.item, depth: 0, overrideAccess: false, req, user: req.user ?? undefined })
    .catch(() => null)
  const transcript = item && item._status === 'published' ? (item.transcript ?? '') : ''
  if (!item || !transcript) throw new APIError('This item cannot take suggestions.', 404, null, true)
  if (!locate(transcript, { quote: data.quote, start: data.start })) {
    throw new APIError('That passage was not found in the transcript. Select it again, or copy it exactly.', 400, null, true)
  }

  const hash = visitorHash(req)
  if (!req.user && hash) {
    const since = (ms: number) => new Date(Date.now() - ms).toISOString()
    const count = async (ms: number) =>
      (
        await req.payload.count({
          collection: 'annotations',
          where: { and: [{ submitterHash: { equals: hash } }, { createdAt: { greater_than: since(ms) } }] },
          overrideAccess: true,
          req,
        })
      ).totalDocs
    if ((await count(60 * 60 * 1000)) >= SUGGESTION_LIMITS.perHour || (await count(24 * 60 * 60 * 1000)) >= SUGGESTION_LIMITS.perDay) {
      throw new APIError('Thank you for your suggestions. Please send more later.', 429, null, true)
    }
  }

  await req.payload.create({
    collection: 'annotations',
    data: {
      item: data.item,
      quote: data.quote,
      start: data.start,
      category: data.category as (typeof ANNOTATION_CATEGORIES)[number]['value'],
      body: data.body,
      status: 'submitted',
      source: req.user ? 'staff' : 'public',
      submitterName: req.user ? null : data.name,
      submitterEmail: req.user ? null : data.email,
      submitterHash: req.user ? null : hash,
    },
    overrideAccess: true,
    req,
  })

  // Tell the project's mailbox about a visitor's suggestion; staff notes need no notice.
  if (!req.user && emailConfigured()) {
    try {
      const origin = siteOrigin(req)
      const mail = suggestionEmail({
        itemId: item.itemId ?? `Item ${item.id}`,
        title: item.title ?? '',
        category: data.category,
        quote: data.quote,
        body: data.body,
        itemLink: `${origin}/items/${item.slug ?? item.id}`,
        reviewLink: `${origin}/review/annotations`,
      })
      await req.payload.sendEmail({ to: suggestionNoticeTo(), subject: mail.subject, html: mail.html, text: mail.text })
    } catch (err) {
      // The suggestion is kept either way, and waits under Review annotations.
      req.payload.logger.error({ err, msg: `Email about a visitor suggestion on item ${item.id} failed` })
    }
  }
  return { ok: true }
}
