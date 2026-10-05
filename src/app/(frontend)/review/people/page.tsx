import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getViewer } from '@/lib/viewer'
import type { Item, Person, User } from '@/payload-types'

import { reviewCluster } from './actions'

export const metadata: Metadata = { title: 'Review possible duplicates', robots: { index: false } }

const idOf = (v: number | { id: number } | null | undefined) => (typeof v === 'object' && v ? v.id : v ?? undefined)

/** Group people linked by "possible duplicate" into clusters; each cluster is one decision. */
function clusters(people: Person[]): Person[][] {
  const byId = new Map(people.map((p) => [p.id, p]))
  const seen = new Set<number>()
  const out: Person[][] = []
  for (const p of people) {
    if (seen.has(p.id) || !(p.possibleDuplicates ?? []).length) continue
    const group: Person[] = []
    const stack = [p.id]
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id) || !byId.has(id)) continue
      seen.add(id)
      const person = byId.get(id)!
      group.push(person)
      for (const d of person.possibleDuplicates ?? []) stack.push(idOf(d)!)
    }
    if (group.length > 1) out.push(group.sort((a, b) => a.name.localeCompare(b.name)))
  }
  return out.sort((a, b) => b.length - a.length || a[0].name.localeCompare(b[0].name))
}

export default async function ReviewPeoplePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { payload, user } = await getViewer()
  const role = (user as User | null)?.role
  if (role !== 'admin' && role !== 'editor') notFound()
  const { status } = await searchParams

  const people = (
    await payload.find({ collection: 'people', pagination: false, depth: 0, draft: true, overrideAccess: false, user })
  ).docs as Person[]
  const items = (
    await payload.find({ collection: 'items', pagination: false, depth: 0, draft: true, select: { people: true }, overrideAccess: false, user })
  ).docs as Pick<Item, 'id' | 'people'>[]
  const itemCount = new Map<number, number>()
  for (const it of items) for (const id of new Set((it.people ?? []).map((r) => idOf(r.person)!))) itemCount.set(id, (itemCount.get(id) ?? 0) + 1)

  const groups = clusters(people)

  return (
    <>
      <h1>Possible duplicates</h1>
      <p className="lede">
        The importer proposes these when names share a surname and their initials agree. It never merges them
        itself. For each group, choose the record to keep, tick the ones that are the same person, and merge — or
        mark them as different people.
      </p>
      {status && (
        <p className={`notice ${status.startsWith('Not done') ? 'notice-draft' : 'notice-staff'}`} role="status">
          {status}
        </p>
      )}
      <p>
        <strong>{groups.length}</strong> {groups.length === 1 ? 'group' : 'groups'} to review.
      </p>

      {groups.map((group) => (
        <form key={group[0].id} action={reviewCluster} className="cluster">
          <fieldset>
            <legend>{group[0].name.split(',')[0]}</legend>
            <table>
              <thead>
                <tr>
                  <th scope="col">Keep</th>
                  <th scope="col">Same person</th>
                  <th scope="col">Name</th>
                  <th scope="col">Also written as</th>
                  <th scope="col">Items</th>
                </tr>
              </thead>
              <tbody>
                {group.map((p, i) => {
                  const others = (p.aliases ?? []).map((a) => a.value).filter((a) => a !== p.name)
                  return (
                    <tr key={p.id}>
                      <td>
                        <input type="radio" name="keep" value={p.id} defaultChecked={i === 0} aria-label={`Keep ${p.name}`} />
                      </td>
                      <td>
                        <input type="checkbox" name="selected" value={p.id} aria-label={`${p.name} is the same person`} />
                      </td>
                      <td>
                        <Link href={`/people/${p.slug}`}>{p.name}</Link>
                        {p.kind !== 'person' && <span className="role"> ({p.kind})</span>}
                        {p.needsReview && <span className="badge badge-draft">uncertain reading</span>}
                      </td>
                      <td className="card-meta">{others.join('; ') || '—'}</td>
                      <td>{itemCount.get(p.id) ?? 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="cluster-actions">
              <button type="submit" name="intent" value="merge" className="button">
                Merge ticked into kept
              </button>
              <button type="submit" name="intent" value="different" className="button-secondary">
                Ticked are different people
              </button>
            </div>
          </fieldset>
        </form>
      ))}
    </>
  )
}
