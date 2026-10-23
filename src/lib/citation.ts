/** Ways to cite a story on this site. Authors are given as "First Last". */

const SITE = 'Documenting Asian American Histories in Ohio'
const PUBLISHER = 'Miami University Libraries'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']

type Name = { first: string; last: string }
const split = (full: string): Name => {
  const parts = full.trim().split(/\s+/)
  return { last: parts.pop() ?? '', first: parts.join(' ') }
}
const day = (iso?: string | null) => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
}

const listChicago = (names: Name[]) =>
  names.map((n, i) => (i === 0 ? `${n.last}, ${n.first}` : `${n.first} ${n.last}`)).join(names.length > 2 ? ', ' : ' and ')

export function citations(o: { title: string; authors: string[]; published?: string | null; url: string }) {
  const names = o.authors.filter(Boolean).map(split)
  const d = day(o.published)
  const chicago = [
    names.length ? `${listChicago(names)}.` : null,
    `“${o.title}.”`,
    `${SITE}, ${PUBLISHER}${d ? `, ${MONTHS[d.m - 1]} ${d.d}, ${d.y}` : ''}.`,
    `${o.url}.`,
  ]
    .filter(Boolean)
    .join(' ')
  const apaNames = names.map((n) => `${n.last}, ${n.first.split(/\s+/).map((f) => `${f[0]}.`).join(' ')}`).join(', ')
  const apa = `${apaNames ? `${apaNames} ` : ''}(${d ? `${d.y}, ${MONTHS[d.m - 1]} ${d.d}` : 'n.d.'}). ${o.title}. ${SITE}. ${o.url}`
  const mla = [
    names.length ? `${names[0].last}, ${names[0].first}${names.length > 1 ? ', et al' : ''}.` : null,
    `“${o.title}.”`,
    `${SITE}, ${PUBLISHER}${d ? `, ${d.d} ${MLA_MONTHS[d.m - 1]} ${d.y}` : ''},`,
    `${o.url.replace(/^https?:\/\//, '')}.`,
  ]
    .filter(Boolean)
    .join(' ')
  return { chicago, apa, mla }
}

/** The site's canonical address for links in citations. */
export function siteBase(): string {
  const first = (process.env.SITE_URL || '').split(',')[0]?.trim().replace(/\/+$/, '')
  if (first) return first
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return 'https://daaho.lib.miamioh.edu'
}
