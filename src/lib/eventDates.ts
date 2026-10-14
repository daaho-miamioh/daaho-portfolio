/** Dates of project events, stored as YYYY-MM-DD text so no time zone can move them a day. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDay(value: string | null | undefined): { y: number; m: number; d: number } | null {
  const match = value ? ISO.exec(value) : null
  if (!match) return null
  const [y, m, d] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? { y, m, d } : null
}

export const validDay = (value: unknown, required = false) => {
  if (value == null || value === '') return required ? 'Required. Use YYYY-MM-DD.' : true
  return parseDay(String(value)) ? true : 'Use a real date in the form YYYY-MM-DD.'
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "July 20, 2024", "March 13–16, 2025", "September 30 – October 2, 2025", "December 30, 2025 – January 2, 2026". */
export function formatEventDates(start: string, end?: string | null): string {
  const a = parseDay(start)
  if (!a) return start
  const b = parseDay(end)
  const day = (x: { m: number; d: number }) => `${MONTHS[x.m - 1]} ${x.d}`
  if (!b || (b.y === a.y && b.m === a.m && b.d === a.d)) return `${day(a)}, ${a.y}`
  if (b.y !== a.y) return `${day(a)}, ${a.y} – ${day(b)}, ${b.y}`
  if (b.m !== a.m) return `${day(a)} – ${day(b)}, ${a.y}`
  return `${day(a)}–${b.d}, ${a.y}`
}

/** Today in Ohio, as YYYY-MM-DD. */
export function todayInOhio(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** An event is upcoming until the end of its last day. */
export const isUpcoming = (e: { start: string; end?: string | null }, today = todayInOhio()) => (e.end || e.start) >= today
