import Link from 'next/link'

import { getViewer } from '@/lib/viewer'
import type { Item } from '@/payload-types'

type Kind = 'people' | 'places' | 'subjects'

/**
 * A–Z index of the people, places or subjects that appear in items this visitor can see. Built from
 * the items, not the entity tables, so it lists only entries that lead somewhere — and, for the
 * public, never a person named only in unpublished documents.
 */
export async function EntityIndex({ kind, title, intro }: { kind: Kind; title: string; intro: string }) {
  const { payload, draft, access } = await getViewer()
  const items = (
    await payload.find({ collection: 'items', pagination: false, depth: 0, draft, select: { people: true, places: true, subjects: true }, ...access })
  ).docs as Pick<Item, 'id' | 'people' | 'places' | 'subjects'>[]

  const counts = new Map<number, number>()
  for (const it of items) {
    const ids =
      kind === 'people'
        ? (it.people ?? []).map((r) => (typeof r.person === 'object' ? r.person?.id : r.person))
        : (it[kind] ?? []).map((t) => (typeof t === 'object' ? t.id : t))
    for (const id of new Set(ids)) if (typeof id === 'number') counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const entries = counts.size
    ? (await payload.find({ collection: kind, where: { id: { in: [...counts.keys()] } }, pagination: false, depth: 0, draft, ...access })).docs
    : []

  const groups = new Map<string, typeof entries>()
  for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const letter = /[a-z]/i.test(e.name[0]) ? e.name[0].toUpperCase() : '#'
    groups.set(letter, [...(groups.get(letter) ?? []), e])
  }

  return (
    <>
      <h1>{title}</h1>
      <p className="lede">{intro}</p>
      {entries.length === 0 ? (
        <p className="empty">Nothing to show yet.</p>
      ) : (
        <>
          <nav className="az" aria-label="Jump to letter">
            <ul role="list">
              {[...groups.keys()].map((l) => (
                <li key={l}>
                  <a href={`#letter-${l}`}>{l}</a>
                </li>
              ))}
            </ul>
          </nav>
          {[...groups].map(([letter, list]) => (
            <section key={letter} aria-labelledby={`letter-${letter}`}>
              <h2 id={`letter-${letter}`}>{letter}</h2>
              <ul className="index-list" role="list">
                {list.map((e) => (
                  <li key={e.id}>
                    <Link href={`/${kind}/${e.slug}`}>{e.name}</Link>
                    {'kind' in e && e.kind !== 'person' && <span className="role"> {e.kind}</span>}
                    <span className="count"> {counts.get(e.id)} {counts.get(e.id) === 1 ? 'item' : 'items'}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  )
}
