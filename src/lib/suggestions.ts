import { createHash } from 'node:crypto'

import { APIError, type PayloadRequest } from 'payload'

import { ANNOTATION_CATEGORIES } from '@/lib/annotationCategories'
import { locate } from '@/lib/anchors'
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
  if (!transcript) throw new APIError('This item cannot take suggestions.', 404, null, true)
  if (!locate(transcript, { quote: data.quote, start: data.start })) {
    throw new APIError('The selected passage was not found in the transcript. Select it again.', 400, null, true)
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
  return { ok: true }
}
