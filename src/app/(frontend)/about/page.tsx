import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Paragraphs } from '@/components/Paragraphs'
import { Sponsors } from '@/components/Sponsors'
import { asMedia, src } from '@/lib/media'
import { getViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'About' }

export default async function AboutPage() {
  const { payload, access } = await getViewer()
  // The mission, goals and funders are edited with the Home page settings.
  const [about, home] = await Promise.all([
    payload.findGlobal({ slug: 'about', depth: 1, ...access }),
    payload.findGlobal({ slug: 'home', depth: 1, ...access }),
  ])
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

      {home.mission && (
        <section id="mission-statement" aria-labelledby="mission-heading" className="band band-dark home-mission">
          <p className="eyebrow">Mission</p>
          <h2 id="mission-heading">Making visible what was previously invisible</h2>
          <Paragraphs text={home.mission} className="mission-text" />
        </section>
      )}

      {(home.goals ?? []).length > 0 && (
        <section id="project-goals" aria-labelledby="goals-heading" className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Project goals</p>
              <h2 id="goals-heading">What we are working toward</h2>
            </div>
          </div>
          <Paragraphs text={home.goalsIntro} className="lede" />
          <ol className="goals">
            {(home.goals ?? []).map((g) => (
              <li key={g.id ?? g.title}>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Keeps old links to /about#team landing next to the way in. */}
      <section id="team" aria-labelledby="team-heading" className="section about-teaser">
        <div>
          <p className="eyebrow">Team</p>
          <h2 id="team-heading">Scholars, librarians, archivists and community partners</h2>
        </div>
        <div>
          <p className="lede">
            DAAHO brings together people across Ohio and beyond to collect, preserve and share Asian American
            histories.
          </p>
          <Link href="/about/team" className="button-secondary">
            Meet our team <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

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

      <Sponsors sponsors={home.sponsors} />
    </>
  )
}
