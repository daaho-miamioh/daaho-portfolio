/**
 * Related items, from the people, subjects, places and genres two items share.
 *
 * Measured on the 128-item batch: a handful of terms sit on most items — correspondence (90),
 * Ohio--Oxford (83), Miami University (63), college students (35). Counted as links they make every
 * item related to every other, so a term on more than a quarter of the visible items is ignored.
 * Among the rest, a rarer shared term says more than a common one, so each counts in proportion to
 * how rare it is; and a shared person says more than a shared subject or place.
 */

export type Kind = 'people' | 'subjects' | 'places' | 'genres'
export type Linkable = { id: number } & Record<Kind, number[]>
export type Shared = { kind: Kind; id: number }
export type Related = { id: number; score: number; shared: Shared[] }

export const WEIGHT: Record<Kind, number> = { people: 3, subjects: 2, places: 1, genres: 0.5 }
const KINDS = Object.keys(WEIGHT) as Kind[]

export function relatedItems(
  target: Linkable,
  items: Linkable[],
  { limit = 6, hubShare = 0.25, minHub = 3 } = {},
): Related[] {
  const n = items.length
  // Below a few items every term is "common"; only exclude hubs once there is a collection to speak of.
  const hubAbove = Math.max(minHub, Math.ceil(hubShare * n))
  const df = new Map<string, number>()
  for (const item of items) {
    for (const kind of KINDS) for (const id of new Set(item[kind])) df.set(`${kind}:${id}`, (df.get(`${kind}:${id}`) ?? 0) + 1)
  }

  const results: Related[] = []
  for (const other of items) {
    if (other.id === target.id) continue
    let score = 0
    const shared: Shared[] = []
    for (const kind of KINDS) {
      const theirs = new Set(other[kind])
      for (const id of new Set(target[kind])) {
        if (!theirs.has(id)) continue
        const count = df.get(`${kind}:${id}`) ?? 0
        if (count > hubAbove) continue
        // Smoothed so a term every item shares still counts a little: plain log(n / count) is 0 there.
        score += WEIGHT[kind] * Math.log(1 + n / count)
        shared.push({ kind, id })
      }
    }
    if (score > 0) results.push({ id: other.id, score, shared })
  }
  return results.sort((a, b) => b.score - a.score || a.id - b.id).slice(0, limit)
}

/** Reduce a Payload item (relations as ids or populated docs) to the ids the scorer needs. */
export function toLinkable(item: {
  id: number
  people?: { person?: number | { id: number } | null }[] | null
  places?: (number | { id: number })[] | null
  subjects?: (number | { id: number })[] | null
  genres?: (number | { id: number })[] | null
}): Linkable {
  const ids = (xs: (number | { id: number } | null | undefined)[] | null | undefined) =>
    (xs ?? []).map((x) => (typeof x === 'object' && x ? x.id : x)).filter((x): x is number => typeof x === 'number')
  return {
    id: item.id,
    people: ids((item.people ?? []).map((row) => row.person)),
    places: ids(item.places),
    subjects: ids(item.subjects),
    genres: ids(item.genres),
  }
}
