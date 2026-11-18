/**
 * Field formats from the DAAHO Mini MAP (Metadata Application Profile), enforced when an item is
 * published so the corrections of 2026-11-18 (metadata pipeline D-020) are not undone by hand.
 * Empty values pass: whether a field is required is a separate rule.
 */

/** Date Created: ISO 8601 (YYYY, YYYY-MM, YYYY-MM-DD); a range joins two with an en dash. */
const ISO = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/
export function validMapDate(value: unknown): true | string {
  if (value == null || value === '') return true
  const v = String(value).trim()
  const parts = v.split('–')
  if (parts.length <= 2 && parts.every((p) => ISO.test(p))) return true
  if (/^\d{4}(-\d{2}){0,2}-\d{4}/.test(v)) return 'Join a range with an en dash (–), e.g. 1910–1920.'
  return 'Use YYYY, YYYY-MM or YYYY-MM-DD (Mini MAP). No approximate dates such as "ca. 1940".'
}

/** Extent: a number and a unit, e.g. 1 page, 3 pages, 1 leaf, 25 minutes. */
export function validMapExtent(value: unknown): true | string {
  if (value == null || value === '') return true
  const m = /^(\d+) (page|pages|leaf|leaves|minute|minutes|item|items)$/.exec(String(value).trim())
  if (!m) return 'A number and a unit (Mini MAP), e.g. 3 pages, 1 leaf, 25 minutes.'
  const one = m[1] === '1'
  const singular = ['page', 'leaf', 'minute', 'item'].includes(m[2])
  return one === singular ? true : `Write ${m[1]} ${one ? m[2].replace(/s$/, '').replace('leave', 'leaf') : m[2] === 'leaf' ? 'leaves' : `${m[2]}s`}.`
}

/** Measurements: height x width in centimeters, e.g. 35 cm x 10 cm. */
export function validMapDimensions(value: unknown): true | string {
  if (value == null || value === '') return true
  return /^\d+(\.\d+)? cm x \d+(\.\d+)? cm$/.test(String(value).trim()) || 'Height x width in cm (Mini MAP), e.g. 28 cm x 21.5 cm.'
}
