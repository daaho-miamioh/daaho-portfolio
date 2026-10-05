import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'

import { asMedia, src } from '@/lib/media'
import { getViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'About' }

export default async function AboutPage() {
  const { payload, access } = await getViewer()
  const [about, team] = await Promise.all([
    payload.findGlobal({ slug: 'about', ...access }),
    payload.find({ collection: 'team', sort: 'order', limit: 100, depth: 1, ...access }),
  ])

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
          held at Miami University that record Asian American lives in Ohio.
        </p>
      )}

      {team.docs.length > 0 && (
        <section aria-labelledby="team-heading">
          <h2 id="team-heading">Project team</h2>
          <ul className="team" role="list">
            {team.docs.map((m) => {
              const photo = asMedia(m.photo)
              return (
                <li key={m.id} className="team-member">
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src(photo, 'thumbnail')} alt={photo.alt} width={160} height={160} loading="lazy" />
                  )}
                  <div>
                    <h3>{m.name}</h3>
                    {m.title && <p className="role">{m.title}</p>}
                    {m.affiliation && <p className="card-meta">{m.affiliation}</p>}
                    {m.bio && (
                      <div className="prose">
                        <RichText data={m.bio} />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
