import type { Metadata } from 'next'

import { TEAM_GROUPS } from '@/collections/Team'
import { Paragraphs } from '@/components/Paragraphs'
import { asMedia, src } from '@/lib/media'
import { getViewer } from '@/lib/viewer'
import type { Team } from '@/payload-types'

export const metadata: Metadata = { title: 'Team', description: 'The scholars, librarians, archivists and community partners behind DAAHO.' }

/** "Dr. John D.M. Green" → "Green", "William (Bill) Hilt" → "Hilt": for ordering people who share an order number. */
const surname = (name: string) => name.replace(/\([^)]*\)/g, '').trim().split(/\s+/).at(-1) ?? name

export default async function TeamPage() {
  const { payload, access } = await getViewer()
  const team = await payload.find({ collection: 'team', sort: 'order', pagination: false, depth: 1, ...access })
  // Within a group, the order number decides; people with the same number are listed by surname.
  const members = (team.docs as Team[]).sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || surname(a.name).localeCompare(surname(b.name)))

  return (
    <>
      <h1>Meet our team</h1>
      <p className="lede">
        Scholars, librarians, archivists and community partners across Ohio and beyond, working together to collect,
        preserve and share Asian American histories.
      </p>
      {members.length === 0 && <p className="empty">Nothing to show yet.</p>}
      {TEAM_GROUPS.map((g) => {
        const list = members.filter((m) => m.group === g.value)
        if (!list.length) return null
        return (
          <section key={g.value} aria-labelledby={`team-${g.value}`} className="team-group">
            <h2 id={`team-${g.value}`}>{g.label}</h2>
            <ul className="team" role="list">
              {list.map((m) => {
                const photo = asMedia(m.photo)
                return (
                  <li key={m.id} className="team-member">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src(photo, 'thumbnail')} alt="" width={160} height={160} loading="lazy" />
                    ) : (
                      <span className="team-nophoto" aria-hidden="true" />
                    )}
                    <div>
                      <h3>{m.name}</h3>
                      {m.title && <p className="role">{m.title}</p>}
                      {m.affiliation && <p className="card-meta">{m.affiliation}</p>}
                      <Paragraphs text={m.bio} className="team-bio" />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}
