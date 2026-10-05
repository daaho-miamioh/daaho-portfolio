import Link from 'next/link'
import React from 'react'

import { getViewer } from '@/lib/viewer'
import type { User } from '@/payload-types'

import './styles.css'

export const metadata = {
  title: { default: 'Documenting Asian American Histories in Ohio', template: '%s — DAAHO' },
  description:
    'Letters, documents and photographs recording Asian American lives in Ohio, from the collections of Miami University.',
}

const NAV = [
  ['/items', 'Items'],
  ['/people', 'People'],
  ['/places', 'Places'],
  ['/subjects', 'Subjects'],
  ['/timeline', 'Timeline'],
  ['/about', 'About'],
] as const

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getViewer()
  const role = (user as User | null)?.role
  const canReview = role === 'admin' || role === 'editor'
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="wrap header-inner">
            <Link href="/" className="site-title">
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
                {canReview && (
                  <li>
                    <Link href="/review/people" className="nav-staff">
                      Review duplicates
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          </div>
        </header>
        <main id="main" className="wrap">
          {children}
        </main>
        <footer className="site-footer">
          <div className="wrap">
            <p>
              Item descriptions and transcriptions are generated with AI from the original scans and reviewed by
              project staff before publication.
            </p>
            <p>
              Miami University Libraries · <Link href="/admin">Staff sign-in</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
