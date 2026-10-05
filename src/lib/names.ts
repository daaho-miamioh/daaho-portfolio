/**
 * Name handling for strings coming out of the metadata pipeline.
 *
 * The pipeline emits personal names as free text, and the 128-record batch contains every failure
 * mode below. Two rules govern everything here:
 *
 *  1. Merge automatically only when two strings are provably the same name — differing in
 *     punctuation, spacing, or "First Last" vs "Last, First" order. "Upham, A.H." and
 *     "Alfred H. Upham" are not provably the same person, so they become a *candidate* pair for a
 *     human to confirm, never an automatic merge.
 *  2. Never invent a person from a string we cannot parse. Ambiguous or corrupted strings are
 *     reported for review instead of becoming bogus records.
 */

export type NameKind = 'person' | 'organization' | 'group'

export type CleanedName =
  | { ok: true; display: string; key: string; kind: NameKind; uncertain: boolean; raw: string }
  | { ok: false; raw: string; reason: string }

const ORG_WORDS =
  /\b(University|College|School|Department|Office|Board|Committee|Council|Association|Society|Legation|Embassy|Consulate|Mission|Center|Centre|Bureau|Ministry|Government|Company|Inc|Club|Church|Foundation|Institute|Library|Y\.?\s?M\.?\s?C\.?\s?A\.?|Y\.?\s?W\.?\s?C\.?\s?A\.?)\b/i
const GROUP_WORDS = /\b(members|students|faculty|staff|alumni|parents)\b/i
const HONORIFIC = /^(Miss|Mrs\.?|Mr\.?|Ms\.?|Dr\.?|Prof\.?|Professor|President|Rev\.?|Dean)\s+/i
const ROMAN = /^(?=[IVXLC]+$)[IVXLC]{1,6}$/
// Model reasoning that leaked into a structured field, e.g. "I. S. O.? No. Need exact. Wait."
const LEAKED_REASONING = /\b(Wait|Need exact|No\.)(\s|$)|\?\s+No\b/
// Several names emitted as one string, separated by quote characters: "A, B`,`C, D" or "A, B','C, D"
const JOINED = /\s*[`'"]\s*,\s*[`'"]\s*/
const UNCERTAIN = /\?|\[unclear\]|\[illegible\]/i

/** Split a raw field value into candidate name strings, undoing quote-joined output. */
export function splitJoined(raw: string): string[] {
  return raw
    .split(JOINED)
    .map((s) => s.replace(/^[`'"\s]+|[`'"\s]+$/g, '').trim())
    .filter(Boolean)
}

function classify(name: string): NameKind {
  if (ORG_WORDS.test(name)) return 'organization'
  if (GROUP_WORDS.test(name)) return 'group'
  return 'person'
}

/**
 * Reorder "Alfred H. Upham" -> "Upham, Alfred H.". Only for unambiguous personal names: regnal
 * names ("Rama V"), honorific forms ("Miss Hamilton"), single words and organizations are left as
 * written, because reordering them would corrupt them.
 */
export function invert(name: string): string {
  const s = name.trim()
  if (s.includes(',') || classify(s) !== 'person' || HONORIFIC.test(s)) return s
  const tokens = s.split(/\s+/)
  if (tokens.length < 2 || tokens.length > 4) return s
  const last = tokens[tokens.length - 1]
  if (ROMAN.test(last)) return s
  return `${last}, ${tokens.slice(0, -1).join(' ')}`
}

/** Exact-merge key: strings with the same key are the same name written differently. */
export function nameKey(name: string): string {
  return invert(name)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Drop a parenthetical that only restates the name: "Lindegren, Alina M. (Alina M. Lindegren)". */
function stripRedundantParenthetical(name: string): string {
  const surname = name.split(',')[0].trim().toLowerCase()
  return name
    .replace(/\s*\(([^)]*)\)/g, (m, inner: string) => (surname && inner.toLowerCase().includes(surname) ? '' : m))
    .trim()
}

export function cleanName(raw: string): CleanedName {
  const s = raw.trim()
  if (!s) return { ok: false, raw, reason: 'empty' }
  if (LEAKED_REASONING.test(s)) {
    return { ok: false, raw, reason: 'model reasoning leaked into the name field' }
  }
  const uncertain = UNCERTAIN.test(s)
  const bare = s.replace(/\s*\[(unclear|illegible)\]\s*/gi, ' ').replace(/\?/g, '').replace(/\s+/g, ' ').trim()
  const kind = classify(bare)
  if (kind === 'person' && (bare.match(/,/g) || []).length > 1) {
    // "Brooks, Ronald, Burton, Kay" is probably two people, but splitting it is a guess.
    return { ok: false, raw, reason: 'more than one comma: possibly several people in one string' }
  }
  const display = kind === 'person' ? stripRedundantParenthetical(invert(bare)) : bare
  return { ok: true, display, key: nameKey(display), kind, uncertain, raw }
}

type Parsed = { surname: string; given: string[] }

function parse(key: string): Parsed {
  const [surname, rest = ''] = key.split(',').map((p) => p.trim())
  return { surname: surname.replace(HONORIFIC, ''), given: rest.split(/[\s-]+/).filter(Boolean) }
}

function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/**
 * Could two differently-keyed personal names refer to the same person? Deliberately generous: a
 * false candidate costs an editor one click, a missed one silently splits a person's items.
 */
export function mayBeSamePerson(keyA: string, keyB: string): boolean {
  if (keyA === keyB) return false
  const a = parse(keyA)
  const b = parse(keyB)
  // A lone word may be a first name ("Jerry"), so it is fuzzy-matched only against another lone
  // word ("Shidler" / "Shideler"), never against a surname ("Berry, Eddye").
  const sameShape = !a.given.length === !b.given.length
  const surnameMatch =
    a.surname === b.surname ||
    (sameShape && Math.min(a.surname.length, b.surname.length) >= 5 && withinOneEdit(a.surname, b.surname))
  if (!surnameMatch) return false
  if (!a.given.length || !b.given.length) return true
  return a.given[0][0] === b.given[0][0]
}

/** Group candidate pairs into clusters: each cluster is one decision for an editor. */
export function clusters(pairs: Map<string, Set<string>>): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const start of pairs.keys()) {
    if (seen.has(start)) continue
    const group: string[] = []
    const stack = [start]
    while (stack.length) {
      const k = stack.pop()!
      if (seen.has(k)) continue
      seen.add(k)
      group.push(k)
      for (const n of pairs.get(k) ?? []) if (!seen.has(n)) stack.push(n)
    }
    out.push(group.sort())
  }
  return out
}
