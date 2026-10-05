/**
 * Which historical events to show beside an item: those under way in the item's year that concern a
 * region the item concerns. Events of that very year come before multi-year periods, major before
 * notable, so a 1937 letter about China shows the Marco Polo Bridge Incident ahead of the war it began.
 */

export type ContextEvent = {
  id: number
  startYear: number
  endYear?: number | null
  regions?: string[] | null
  importance?: 'major' | 'notable' | null
}

export function yearOf(dateSort: string | null | undefined): number | null {
  const m = dateSort ? /^(\d{4})/.exec(dateSort) : null
  return m ? Number(m[1]) : null
}

export function eventsForItem<E extends ContextEvent>(
  item: { year: number | null; regions: string[]; pinned?: E[]; hideAutomatic?: boolean },
  events: E[],
  limit = 3,
): E[] {
  const pinned = item.pinned ?? []
  if (item.hideAutomatic || item.year === null || !item.regions.length) return pinned.slice(0, limit)
  const year = item.year
  const regions = new Set(item.regions)
  const span = (e: E) => (e.endYear ?? e.startYear) - e.startYear
  // "That year" means a single-year event dated then — the war that began in 1937 is still a period.
  const ofThatYear = (e: E) => span(e) === 0 && e.startYear === year
  const automatic = events
    .filter((e) => e.startYear <= year && year <= (e.endYear ?? e.startYear))
    .filter((e) => (e.regions ?? []).some((r) => regions.has(r)))
    .filter((e) => !pinned.some((p) => p.id === e.id))
    .sort(
      (a, b) =>
        Number(!ofThatYear(a)) - Number(!ofThatYear(b)) ||
        Number(a.importance !== 'major') - Number(b.importance !== 'major') ||
        span(a) - span(b) ||
        a.id - b.id,
    )
  return [...pinned, ...automatic].slice(0, limit)
}
