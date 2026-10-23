/**
 * What the public may see of an item. Much of an item is drafted by AI from the scans — title, date,
 * description, transcript, and the people, places and subjects it names — and none of that is shown
 * to the public until a member of staff has checked it. Staff see everything. The library's catalog
 * record (archival fields, rights, creator, extent) is written by people and is always public, as are
 * the scans of a published item.
 */

export const CHECKS = [
  { name: 'titleChecked', label: 'Title and date', parts: ['title', 'date'] },
  { name: 'descriptionChecked', label: 'Description', parts: ['description'] },
  { name: 'transcriptChecked', label: 'Transcript', parts: ['transcript'] },
  { name: 'linksChecked', label: 'People, places and subjects', parts: ['people', 'places', 'subjects', 'genres'] },
] as const

export type CheckName = (typeof CHECKS)[number]['name']

type FieldAccessArgs = { req: { user?: unknown }; doc?: { review?: Partial<Record<CheckName, boolean | null>> | null; translation?: { status?: string | null } | null } }

/**
 * Field-level read access: staff always; the public only once the part is checked. Without a document
 * (as when Payload validates a query) the answer is no for the public, so nobody outside can search
 * or filter by text they cannot read — a count of matches would otherwise reveal what it contains.
 */
export const publicOnceChecked =
  (check: CheckName) =>
  ({ req, doc }: FieldAccessArgs) =>
    !!req.user || doc?.review?.[check] === true

export const publicOnceTranslated = ({ req, doc }: FieldAccessArgs) =>
  !!req.user || doc?.translation?.status === 'verified' || doc?.translation?.status === 'human'

export const staffOnly = ({ req }: FieldAccessArgs) => !!req.user

type Doc = {
  itemId?: string | null
  title?: string | null
  date?: string | null
  dateSort?: string | null
  description?: string | null
  transcript?: string | null
  translation?: { text?: string | null; status?: string | null } | null
  people?: unknown[] | null
  places?: unknown[] | null
  subjects?: unknown[] | null
  genres?: unknown[] | null
  archival?: { type?: string | null; creator?: string | null } | null
  review?: Partial<Record<CheckName, boolean | null>> & { notes?: string | null } | null
  ai?: unknown
  importIssues?: unknown
  publicText?: string | null
}

const checked = (doc: Doc, name: CheckName) => doc.review?.[name] === true

/** A title that says only what is certain, for items whose title has not been checked. */
export const neutralTitle = (doc: Doc) => [doc.itemId, doc.archival?.type || 'Archival item'].filter(Boolean).join(' · ')

/** A translation is public once a person has verified it or made it. */
export const translationPublic = (doc: Doc) => doc.translation?.status === 'verified' || doc.translation?.status === 'human'

/** Labels of the parts staff can see but the public cannot yet. */
export function hiddenParts(doc: Doc): string[] {
  const out: string[] = CHECKS.filter((c) => !checked(doc, c.name)).map((c) => c.label)
  if (doc.translation?.text?.trim() && !translationPublic(doc)) out.push('English translation')
  return out
}

/** The item as the public may read it. Never changes the stored record. */
export function stripForPublic<T extends Doc>(doc: T): T {
  const out: Doc & Record<string, unknown> = { ...doc }
  if (!checked(doc, 'titleChecked')) {
    out.title = neutralTitle(doc)
    out.date = null
    out.dateSort = null
  }
  if (!checked(doc, 'descriptionChecked')) out.description = null
  if (!checked(doc, 'transcriptChecked')) out.transcript = null
  if (!checked(doc, 'linksChecked')) {
    out.people = []
    out.places = []
    out.subjects = []
    out.genres = []
  }
  if (!translationPublic(doc)) out.translation = null
  // Working notes and AI provenance are for staff.
  delete out.ai
  delete out.importIssues
  if (out.review) out.review = { ...out.review, notes: null }
  return out as T
}

/**
 * Text the public search may match: only what the public can read, so a search can never reveal
 * whether a hidden transcript contains a word.
 */
export function publicSearchText(doc: Doc): string {
  const parts = [
    checked(doc, 'titleChecked') ? doc.title : neutralTitle(doc),
    doc.archival?.creator,
    checked(doc, 'descriptionChecked') ? doc.description : null,
    checked(doc, 'transcriptChecked') ? doc.transcript : null,
    translationPublic(doc) ? doc.translation?.text : null,
  ]
  return parts.filter((p): p is string => !!p?.trim()).join('\n\n')
}
