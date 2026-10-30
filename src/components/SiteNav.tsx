'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SECTIONS, sectionOf, tabOf } from '@/lib/sections'

/** "page" on the page itself, "true" on a page inside it, such as an item under Items. */
const current = (pathname: string, href: string, on: boolean) => (on ? (pathname === href ? 'page' : 'true') : undefined)

/** The main menu, marking the section the visitor is in. */
export function MainNav({ submit }: { submit: { url: string; label: string } | null }) {
  const pathname = usePathname()
  const section = sectionOf(pathname)
  return (
    <nav aria-label="Main">
      <ul role="list">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} aria-current={current(pathname, s.href, s === section)}>
              {s.label}
            </Link>
          </li>
        ))}
        {submit && (
          <li>
            <a href={submit.url} className="nav-cta">
              {submit.label}
            </a>
          </li>
        )}
      </ul>
    </nav>
  )
}

/** The pages of the visitor's section, under the header. Nothing on pages outside a section with tabs. */
export function SectionNav() {
  const pathname = usePathname()
  const section = sectionOf(pathname)
  if (!section?.tabs) return null
  const tab = tabOf(section, pathname)
  return (
    <nav className="section-nav" aria-label={section.label}>
      <div className="wrap">
        <ul role="list">
          {section.tabs.map(([href, label]) => (
            <li key={href}>
              <Link href={href} aria-current={current(pathname, href, href === tab)}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
