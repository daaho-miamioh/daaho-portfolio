/**
 * A list of people pasted into the batch invitation box, read into names and addresses. One person
 * per line, in whatever shape people paste: "Ann Lee, ann@x.edu", "Ann Lee <ann@x.edu>",
 * "ann@x.edu (Ann Lee)", or a row copied from a spreadsheet, columns in either order.
 */

export type InviteRow = { line: number; name: string; email: string; problem?: string }

/** Enough for a class or a cohort; more at once is more likely a pasting mistake. */
export const MAX_BATCH = 50

const FIND_EMAIL = /[^\s<>()[\],;:"'|]+@[^\s<>()[\],;:"'|]+\.[^\s<>()[\],;:"'|]+/
// What sits between a name and an address: separators, brackets, quotes, a dash.
const EDGES = /^[\s,;:<>()[\]"|–—-]+|[\s,;:<>()[\]"|–—-]+$/g

const clean = (s: string) => s.replace(EDGES, '').replace(/\s+/g, ' ')

function read(line: string): { name: string; email: string } | null {
  // A spreadsheet row: the name is the first cell that is not the address; later cells (a role, a
  // department) are not part of it.
  if (line.includes('\t')) {
    const cells = line.split('\t').map(clean).filter(Boolean)
    const at = cells.findIndex((c) => FIND_EMAIL.test(c))
    if (at < 0) return null
    const email = cells[at].match(FIND_EMAIL)![0]
    return { email, name: cells.find((c, i) => i !== at) ?? '' }
  }
  const match = line.match(FIND_EMAIL)
  if (!match || match.index === undefined) return null
  const before = clean(line.slice(0, match.index))
  const after = clean(line.slice(match.index + match[0].length))
  return { email: match[0], name: [before, after].filter(Boolean).join(' ') }
}

export function parseInviteList(text: string): InviteRow[] {
  const rows: InviteRow[] = []
  const seen = new Set<string>()
  let ready = 0
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const found = read(line)
    if (!found) {
      // The heading row of a copied spreadsheet ("Name  Email") is not a person.
      if (/\be-?mail\b/i.test(line)) return
      rows.push({ line: i + 1, name: clean(line), email: '', problem: 'No email address on this line.' })
      return
    }
    const row: InviteRow = { line: i + 1, name: found.name, email: found.email.toLowerCase() }
    if (row.name.includes('@')) row.problem = 'Put one person on each line.'
    else if (!row.name) row.problem = 'Add their name; the invitation greets them by it.'
    else if (seen.has(row.email)) row.problem = 'Listed twice; the first is used.'
    else if (ready >= MAX_BATCH) row.problem = `More than ${MAX_BATCH} at once; send these in another batch.`
    seen.add(row.email)
    if (!row.problem) ready++
    rows.push(row)
  })
  return rows
}
