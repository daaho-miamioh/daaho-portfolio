const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const ISO = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

/** Pipeline dates are YYYY-MM-DD, YYYY-MM, YYYY or null. Returns a sortable ISO date or null. */
export function sortableDate(raw: string | null | undefined): string | null {
  const m = raw ? ISO.exec(raw.trim()) : null
  if (!m) return null
  return `${m[1]}-${m[2] ?? '01'}-${m[3] ?? '01'}`
}

/** "1923-10-15" -> "October 15, 1923"; "1938-01" -> "January 1938"; "1976" -> "1976". */
export function displayDate(raw: string | null | undefined): string {
  const m = raw ? ISO.exec(raw.trim()) : null
  if (!m) return raw?.trim() || 'Undated'
  const [, y, mo, d] = m
  if (!mo) return y
  const month = MONTHS[Number(mo) - 1]
  if (!month) return raw!.trim()
  return d ? `${month} ${Number(d)}, ${y}` : `${month} ${y}`
}
