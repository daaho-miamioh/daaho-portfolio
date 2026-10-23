/**
 * Read CSV as exported by Google Sheets or Excel (RFC 4180): commas, quoted fields with commas,
 * doubled quotes and line breaks inside, CRLF or LF line ends, and a byte-order mark.
 * Returns rows as objects keyed by header; where a header repeats, the first column wins.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows
  if (!header) return []
  return body
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => {
      const out: Record<string, string> = {}
      header.forEach((h, i) => {
        if (!(h in out)) out[h] = (r[i] ?? '').trim()
      })
      return out
    })
}
