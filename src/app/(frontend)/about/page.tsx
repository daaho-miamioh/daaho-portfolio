import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'

import { TEAM_GROUPS } from '@/collections/Team'
import { Paragraphs } from '@/components/Paragraphs'
import { asMedia, src } from '@/lib/media'
import { getViewer } from '@/lib/viewer'
import type { Team } from '@/payload-types'

export const metadata: Metadata = { title: 'About' }

/** "Dr. John D.M. Green" → "Green", "William (Bill) Hilt" → "Hilt": for ordering people who share an order number. */
const surname = (name: string) => name.replace(/\([^)]*\)/g, '').trim().split(/\s+/).at(-1) ?? name

export default async function AboutPage() {
  const { payload, access } = await getViewer()
  const [about, team] = await Promise.all([
    payload.findGlobal({ slug: 'about', depth: 1, ...access }),
    payload.find({ collection: 'team', sort: 'order', pagination: false, depth: 1, ...access }),
  ])
  // Within a group, the order number decides; people with the same number are listed by surname.
  const members = (team.docs as Team[]).sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || surname(a.name).localeCompare(surname(b.name)))
  const logo = asMedia(about.logo?.image)

  return (
    <>
      <h1>{about.heading}</h1>
      {about.body ? (
        <div className="prose">
          <RichText data={about.body} />
        </div>
      ) : (
        <p className="lede">
          Documenting Asian American Histories in Ohio (DAAHO) brings together letters, documents and photographs
          that record Asian American lives in Ohio.
        </p>
      )}

      {members.length > 0 && (
        <section id="team" aria-labelledby="team-heading">
          <h2 id="team-heading">Meet our team</h2>
          {TEAM_GROUPS.map((g) => {
            const list = members.filter((m) => m.group === g.value)
            if (!list.length) return null
            return (
              <section key={g.value} aria-labelledby={`team-${g.value}`} className="team-group">
                <h3 id={`team-${g.value}`}>{g.label}</h3>
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
                          <h4>{m.name}</h4>
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
        </section>
      )}

      {about.logo?.text && (
        <section id="logo" aria-labelledby="logo-heading" className="about-logo">
          <h2 id="logo-heading">{about.logo.heading || 'About our logo'}</h2>
          <div className="about-logo-body">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={src(logo, 'card')} alt={logo.alt} width={240} loading="lazy" />}
            <Paragraphs text={about.logo.text} className="prose" />
          </div>
        </section>
      )}
    </>
  )
}
