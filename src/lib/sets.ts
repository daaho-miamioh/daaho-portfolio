import { FORMATS } from '@/collections/Items'
import { dateField } from '@/lib/itemsQuery'
import { asMedia } from '@/lib/media'
import type { getViewer } from '@/lib/viewer'
import type { Item, ItemSet, Media } from '@/payload-types'

type Viewer = Awaited<ReturnType<typeof getViewer>>
type Seen = Pick<Item, 'id' | 'set' | 'format' | 'dateSort' | 'publicDateSort' | 'pages'>

export type SetSummary = {
  set: ItemSet
  count: number
  /** "items", or "oral histories" when every item is that one format: the word after the count. */
  noun: string
  /** "1910–1988", from the dates this visitor can see; null when none is. */
  span: string | null
  /** Above the title: the collection's own words for what it holds, else its one format. */
  kind: string | null
  /** Up to three scans from across its dates, its cover first; none for a collection of recordings. */
  scans: Media[]
  /** True when its items are recordings, which have no scans to show. */
  recordings: boolean
}

const formatLabel: Record<string, string> = Object.fromEntries(FORMATS.map((f) => [f.value, f.label]))
const RECORDINGS = new Set(['oral_history', 'audio', 'video'])
const plural = (label: string) => label.toLowerCase().replace(/y$/, 'ie') + 's'
export const idOf = (v: number | { id: number } | null | undefined) => (typeof v === 'object' ? v?.id : v)

/** The name for a collection where space is short: on an item's card and page. */
export const setName = (set: ItemSet) => set.shortTitle || set.title

/** The span of ISO dates as years: "1910–1988", or one year. */
export function yearSpan(dates: (string | null | undefined)[]): string | null {
  const years = dates.filter((d): d is string => !!d).map((d) => d.slice(0, 4)).sort()
  if (!years.length) return null
  return years[0] === years.at(-1) ? years[0] : `${years[0]}–${years.at(-1)}`
}

/** "items", "item", or "oral histories" when every item is one format other than a document. */
export function holdingsNoun(count: number, formats: (string | null | undefined)[]): string {
  const kinds = new Set(formats.map((f) => f ?? 'document'))
  const only = kinds.size === 1 ? [...kinds][0] : null
  const noun = only && only !== 'document' && formatLabel[only] ? formatLabel[only].toLowerCase() : 'item'
  return count === 1 ? noun : plural(noun)
}

/**
 * A glimpse across a collection's dates: the middle of a list, then its first and last, without
 * repeats. Fanned out on its card, the first lies left, the last right, the middle in front.
 */
export function acrossTheRange<T>(xs: T[]): T[] {
  return [...new Set([xs[Math.floor((xs.length - 1) / 2)], xs[0], xs[xs.length - 1]].filter((x) => x !== undefined))]
}

/**
 * The collections this visitor may see, in order, each with what it holds among the items they may
 * see. Staff also see collections with nothing published yet; the public never sees an empty one.
 */
export async function loadSets(viewer: Viewer): Promise<SetSummary[]> {
  const { payload, user, draft, access } = viewer
  const sets = (await payload.find({ collection: 'sets', pagination: false, depth: 1, draft, sort: 'order', ...access })).docs as ItemSet[]
  if (!sets.length) return []
  const items = (
    await payload.find({
      collection: 'items',
      pagination: false,
      depth: 0,
      draft,
      // `review` lets the read hook tell which dates the public may see.
      select: { set: true, format: true, dateSort: true, publicDateSort: true, pages: true, review: true },
      sort: dateField(!user),
      ...access,
    })
  ).docs as Seen[]

  const bySet = new Map<number, Seen[]>()
  for (const item of items) {
    const id = idOf(item.set)
    if (id) bySet.set(id, [...(bySet.get(id) ?? []), item])
  }

  const scanIds = new Map<number, number[]>()
  for (const [id, its] of bySet) {
    scanIds.set(id, acrossTheRange(its.map((i) => idOf(i.pages?.[0]?.image)).filter((m): m is number => !!m)))
  }
  const wanted = [...scanIds.values()].flat()
  const media = wanted.length
    ? new Map(((await payload.find({ collection: 'media', where: { id: { in: wanted } }, pagination: false, depth: 0, ...access })).docs as Media[]).map((m) => [m.id, m]))
    : new Map<number, Media>()

  return sets
    .map((set) => {
      const its = bySet.get(set.id) ?? []
      const formats = its.map((i) => i.format)
      const kinds = new Set(formats.map((f) => f ?? 'document'))
      const only = kinds.size === 1 ? [...kinds][0] : null
      const cover = asMedia(set.cover)
      const scans = (scanIds.get(set.id) ?? []).map((id) => media.get(id)).filter((m): m is Media => !!m && m.id !== cover?.id)
      return {
        set,
        count: its.length,
        noun: holdingsNoun(its.length, formats),
        span: yearSpan(its.map((i) => (user ? i.dateSort : i.publicDateSort))),
        kind: set.kind || (only && only !== 'document' ? plural(formatLabel[only]).replace(/^./, (c) => c.toUpperCase()) : null),
        scans: (cover ? [cover, ...scans] : scans).slice(0, 3),
        recordings: !!only && RECORDINGS.has(only),
      }
    })
    .filter((s) => user || s.count > 0)
}
