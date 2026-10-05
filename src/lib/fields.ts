/**
 * A pipeline field as a list. Values arrive as arrays, single strings, or — for places — one string
 * holding several headings: "Ohio--Oxford; District of Columbia--Washington". Treating that as one
 * place would silently unlink the item from both.
 */
export function asList(value: unknown): string[] {
  if (value == null) return []
  return (Array.isArray(value) ? value : [value])
    .flatMap((x) => String(x).split(';'))
    .map((s) => s.trim())
    .filter(Boolean)
}
