/**
 * What the activity log records about a change: which fields differ, each shown short. Pure, so the
 * hooks in src/hooks/activity.ts stay thin and this part can be tested without a database.
 */

export const ACTIONS = [
  { label: 'Created', value: 'create' },
  { label: 'Updated', value: 'update' },
  { label: 'Published', value: 'publish' },
  { label: 'Unpublished', value: 'unpublish' },
  { label: 'Deleted', value: 'delete' },
  { label: 'Invited', value: 'invite' },
  { label: 'Signed in', value: 'login' },
  { label: 'Signed out', value: 'logout' },
  { label: 'Sign-in failed', value: 'login_failed' },
  { label: 'Asked to reset password', value: 'reset_requested' },
  { label: 'Set a new password', value: 'password' },
] as const

export type Action = (typeof ACTIONS)[number]['value']

/** A value as the log shows it: short text, a number, true/false, or nothing. */
export type Shown = string | number | boolean | null
export type Changes = Record<string, { from: Shown; to: Shown }>

// Bookkeeping, recorded as the action instead, or secret: never compared, never stored.
const SKIP = new Set([
  'id',
  'createdAt',
  'updatedAt',
  '_status',
  'password',
  'hash',
  'salt',
  'resetPasswordToken',
  'resetPasswordExpiration',
  'loginAttempts',
  'lockUntil',
  'sessions',
  '_verificationToken',
  'apiKey',
  'apiKeyIndex',
])

const LIMIT = 200
/** How much to show before the first difference in a long text, so the change itself is in view. */
const LEAD = 60

type Plain = Record<string, unknown>
const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v)
const isRichText = (v: unknown): v is { root: Plain } => isPlain(v) && isPlain(v.root)
// A related record fetched in full; the log keeps only its ID, as an unfetched one would have.
const isRecord = (v: unknown): v is { id: number | string } => isPlain(v) && 'id' in v && ('createdAt' in v || 'updatedAt' in v)
const isRows = (v: unknown): v is Plain[] => Array.isArray(v) && v.every(isPlain)
const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

function plainText(node: unknown): string {
  if (!isPlain(node)) return ''
  if (typeof node.text === 'string') return node.text
  const children = Array.isArray(node.children) ? node.children.map(plainText) : []
  return children.join(node.type === 'root' ? '\n' : '')
}

/** A value with fetched records reduced to their IDs, and rich text to its words. */
function normal(v: unknown): unknown {
  if (isRecord(v)) return v.id
  if (isRichText(v)) return plainText(v.root)
  if (Array.isArray(v)) return v.map(normal)
  if (isPlain(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normal(x)]))
  return v
}

/** Text cut to the limit, starting a little before `at` when that is where the interest lies. */
function excerpt(text: string, at = 0) {
  const start = text.length > LIMIT && at > LEAD ? at - LEAD : 0
  return (start > 0 ? '…' : '') + text.slice(start, start + LIMIT) + (start + LIMIT < text.length ? '…' : '')
}

function shown(v: unknown, at?: number): Shown {
  if (isEmpty(v)) return null
  if (typeof v === 'string') return excerpt(v, at)
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (isRows(v)) return v.length === 1 ? '1 entry' : `${v.length} entries`
  if (Array.isArray(v)) return excerpt(v.join(', '))
  return excerpt(JSON.stringify(v))
}

const firstDifference = (a: string, b: string) => {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/** Groups and same-length lists of rows are compared field by field ("names.2.role"); the rest whole. */
function diff(a: unknown, b: unknown, path: string, out: Changes) {
  if ((isEmpty(a) && isEmpty(b)) || JSON.stringify(a) === JSON.stringify(b)) return
  if (isPlain(a) && isPlain(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!SKIP.has(key)) diff(a[key], b[key], `${path}.${key}`, out)
    }
  } else if (isRows(a) && isRows(b) && a.length === b.length) {
    a.forEach((row, i) => diff(row, b[i], `${path}.${i + 1}`, out))
  } else {
    const at = typeof a === 'string' && typeof b === 'string' ? firstDifference(a, b) : undefined
    out[path] = { from: shown(a, at), to: shown(b, at) }
  }
}

/**
 * The fields that differ between two versions of a record. Only fields the newer version has are
 * compared: one it lacks was hidden from this read or not asked for, which is not a change. `ignore`
 * names fields nobody sees, which the code keeps up to date (an item's search text).
 */
export function changesBetween(before: Plain | null | undefined, after: Plain, ignore: Set<string> = new Set()): Changes {
  const out: Changes = {}
  for (const key of Object.keys(after)) {
    if (!SKIP.has(key) && !ignore.has(key)) diff(normal(before?.[key]), normal(after[key]), key, out)
  }
  return out
}

/** What a deleted record held, so the log still says what was lost. */
export function snapshot(doc: Plain, ignore: Set<string> = new Set()): Changes {
  return Object.fromEntries(
    Object.entries(doc)
      .filter(([key, v]) => !SKIP.has(key) && !ignore.has(key) && !isEmpty(normal(v)))
      .map(([key, v]) => [key, { from: shown(normal(v)), to: null }]),
  )
}

/** A record's name in the log: the field the admin titles it by, after the project's own ID if it has one. */
export function titleOf(doc: Plain, useAsTitle?: string): string {
  const name = [useAsTitle, 'title', 'name', 'filename'].map((f) => f && doc[f]).find((v) => typeof v === 'string' && v.trim())
  const title = ([doc.itemId, name].filter((v) => typeof v === 'string' && v).join(' · ') || `#${doc.id}`).replace(/\s+/g, ' ')
  return title.length > 120 ? `${title.slice(0, 119)}…` : title
}
