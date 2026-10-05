import type { Where } from 'payload'

export type ItemFilters = { q?: string; decade?: string; place?: string; subject?: string; genre?: string }
export type ResolvedIds = { place?: number; subject?: number; genre?: number }

const DECADE = /^(\d{3})0s?$/

/** Read filters from the URL. Unknown values are dropped rather than trusted. */
export function readFilters(params: Record<string, string | string[] | undefined>): ItemFilters {
  const one = (k: string) => {
    const v = params[k]
    const s = (Array.isArray(v) ? v[0] : v)?.trim()
    return s ? s.slice(0, 200) : undefined
  }
  const decade = one('decade')
  return {
    q: one('q'),
    decade: decade === 'undated' || (decade && DECADE.test(decade)) ? decade : undefined,
    place: one('place'),
    subject: one('subject'),
    genre: one('genre'),
  }
}

/**
 * Filters as a Payload query. A filter naming a slug that does not exist matches nothing — it must
 * not silently widen to "everything", or a mistyped link shows the whole collection as its results.
 */
export function buildItemsWhere(f: ItemFilters, ids: ResolvedIds): Where | undefined {
  const and: Where[] = []
  if (f.q) {
    // `like` is case-insensitive and requires every word, wherever it appears in the field.
    and.push({ or: [{ title: { like: f.q } }, { description: { like: f.q } }, { transcript: { like: f.q } }] })
  }
  if (f.decade === 'undated') and.push({ dateSort: { exists: false } })
  else if (f.decade) {
    const start = Number(DECADE.exec(f.decade)![1]) * 10
    and.push({ dateSort: { greater_than_equal: `${start}-01-01` } }, { dateSort: { less_than: `${start + 10}-01-01` } })
  }
  for (const key of ['place', 'subject', 'genre'] as const) {
    if (!f[key]) continue
    const field = `${key === 'place' ? 'places' : `${key}s`}`
    and.push({ [field]: { in: [ids[key] ?? -1] } })
  }
  return and.length ? { and } : undefined
}

/** Decades present among the visible items, with counts, for the filter menu. */
export function decadeOptions(dateSorts: (string | null | undefined)[]): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const d of dateSorts) {
    const key = d ? `${d.slice(0, 3)}0s` : 'undated'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts]
    .sort(([a], [b]) => (a === 'undated' ? 1 : b === 'undated' ? -1 : a.localeCompare(b)))
    .map(([value, count]) => ({ value, label: value === 'undated' ? 'Undated' : value, count }))
}

/** Query string for a page of results, keeping the active filters. */
export function filterHref(base: string, f: ItemFilters, page = 1): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v) params.set(k, v)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}
