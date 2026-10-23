import { Analytics } from '@vercel/analytics/next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import React from 'react'

import { getViewer } from '@/lib/viewer'
import type { User } from '@/payload-types'

import './styles.css'

// Downloaded at build time and served from this site, so visitors' browsers never contact Google.
const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata = {
  title: { default: 'Documenting Asian American Histories in Ohio', template: '%s — DAAHO' },
  description:
    'Letters, documents and photographs recording Asian American lives in Ohio, from the collections of Miami University.',
}

const NAV = [
  ['/items', 'Items'],
  ['/stories', 'Stories'],
  ['/people', 'People'],
  ['/places', 'Places'],
  ['/subjects', 'Subjects'],
  ['/timeline', 'Timeline'],
  ['/events', 'Events'],
  ['/about', 'About'],
] as const

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { payload, user } = await getViewer()
  const home = await payload.findGlobal({ slug: 'home', depth: 0, overrideAccess: false, user })
  const submit = home.submitLink?.url ? home.submitLink : null
  const role = (user as User | null)?.role
  const canReview = role === 'admin' || role === 'editor'
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="wrap header-inner">
            <Link href="/" className="site-title">
              {/* The name is in the text beside it, so the logo itself is not announced. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/daaho-mark.svg" alt="" width={32} height={32} className="brand-logo" />
              <span className="site-title-short">DAAHO</span>
              <span className="site-title-long">Documenting Asian American Histories in Ohio</span>
            </Link>
            <nav aria-label="Main">
              <ul role="list">
                {NAV.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
                {submit && (
                  <li>
                    <a href={submit.url!} className="nav-cta">
                      {submit.label || 'Submit a collection'}
                    </a>
                  </li>
                )}
              </ul>
            </nav>
          </div>
          {canReview && (
            <nav className="staff-bar" aria-label="Staff">
              <div className="wrap">
                <span className="staff-label">Staff</span>
                <Link href="/review/people">Review duplicates</Link>
                <Link href="/review/annotations">Review annotations</Link>
                <Link href="/admin">Admin</Link>
              </div>
            </nav>
          )}
        </header>
        <main id="main" className="wrap">
          {children}
        </main>
        <footer className="site-footer">
          <div className="wrap footer-grid">
            <div className="footer-brand">
              <p className="footer-title">
                <span className="footer-logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/daaho-mark.svg" alt="" width={36} height={36} />
                </span>
                DAAHO
              </p>
              <p>
                Documenting Asian American Histories in Ohio — letters, documents and photographs recording Asian
                American lives in Ohio, gathered by scholars, librarians, archivists and community partners.
              </p>
            </div>
            <nav aria-label="Explore" className="footer-links">
              <p className="footer-heading">Explore</p>
              <ul role="list">
                {NAV.slice(0, 6).map(([href, label]) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Project" className="footer-links">
              <p className="footer-heading">Project</p>
              <ul role="list">
                <li>
                  <Link href="/about">About and team</Link>
                </li>
                <li>
                  <Link href="/events">Events</Link>
                </li>
                <li>
                  <Link href="/harmful-language">Statement on harmful language</Link>
                </li>
                <li>
                  <Link href="/admin">Staff sign-in</Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="wrap footer-fine">
            <p>
              Item descriptions and transcriptions are generated with AI from the original scans. Each item page says
              whether project staff have reviewed it yet. Some documents contain language that is harmful.
            </p>
            <p>
              &copy; {new Date().getFullYear()} Miami University Libraries · Funded by the National Historical Publications
              and Records Commission (NHPRC)
            </p>
          </div>
        </footer>
        {/* Visitor counts while the site is on Vercel: cookieless, and served from this site. Off on the
            library server, which has no Vercel endpoint, and for signed-in staff, so their own browsing
            does not count as visits. */}
        {process.env.VERCEL && !user && <Analytics />}
      </body>
    </html>
  )
}
