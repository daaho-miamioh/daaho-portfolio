/**
 * Requests to join the project, made on the public form at /join: what the form asks and what counts
 * as a complete answer. Pure, so the form checks as people type and the server checks the same way.
 */

export const REQUEST_KINDS = [
  { label: 'Student or student worker', value: 'student' },
  { label: 'Faculty member or researcher', value: 'researcher' },
  { label: 'Librarian or archivist', value: 'library' },
  { label: 'Community member or partner', value: 'community' },
  { label: 'Other', value: 'other' },
] as const

export type RequestKind = (typeof REQUEST_KINDS)[number]['value']

export const REQUEST_STATUSES = [
  { label: 'Waiting', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Declined', value: 'declined' },
] as const

export type Application = { name: string; email: string; affiliation: string; kind: string; reason: string }
export type ApplicationErrors = Partial<Record<keyof Application, string>>

export const LIMITS = { name: 120, email: 254, affiliation: 200, reason: 2000 } as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function checkApplication(input: Record<string, unknown>): { data: Application; errors: ApplicationErrors } {
  const text = (key: keyof Application) => String(input[key] ?? '').trim()
  const data: Application = {
    name: text('name').replace(/\s+/g, ' '),
    email: text('email').toLowerCase(),
    affiliation: text('affiliation').replace(/\s+/g, ' '),
    kind: text('kind'),
    reason: text('reason'),
  }
  const errors: ApplicationErrors = {}
  if (!data.name) errors.name = 'Enter your name.'
  else if (data.name.length > LIMITS.name) errors.name = `Keep your name under ${LIMITS.name} characters.`
  if (!EMAIL.test(data.email) || data.email.length > LIMITS.email) errors.email = 'Enter a valid email address.'
  if (data.affiliation.length > LIMITS.affiliation) errors.affiliation = `Keep this under ${LIMITS.affiliation} characters.`
  if (!REQUEST_KINDS.some((k) => k.value === data.kind)) errors.kind = 'Choose the closest description.'
  if (!data.reason) errors.reason = 'Tell us briefly what you would like to do.'
  else if (data.reason.length > LIMITS.reason) errors.reason = `Keep this under ${LIMITS.reason} characters.`
  return { data, errors }
}

export const kindLabel = (kind: string | null | undefined) => REQUEST_KINDS.find((k) => k.value === kind)?.label ?? kind ?? ''
