'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { SECTIONS, sectionOf, tabOf, type Section } from '@/lib/sections'

/** "page" on the page itself, "true" on a page inside it, such as an item under Items. */
const current = (pathname: string, href: string, on: boolean) => (on ? (pathname === href ? 'page' : 'true') : undefined)

/**
 * A section with pages: a button that shows them. Opens on hover where there is a mouse, and on
 * click or Enter everywhere; Escape or a click elsewhere closes it.
 */
function NavMenu({ section, here, pathname, end }: { section: Section; here: boolean; pathname: string; end: boolean }) {
  const [open, setOpen] = useState(false)
  // Closed on purpose with the pointer still over it: hover must not show it again until the pointer leaves.
  const [dismissed, setDismissed] = useState(false)
  const ref = useRef<HTMLLIElement>(null)
  const id = `menu-${section.href.slice(1)}`
  const tab = tabOf(section, pathname)
  const close = () => {
    setOpen(false)
    setDismissed(true)
  }

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      setDismissed(true)
      ref.current?.querySelector('button')?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <li
      ref={ref}
      className={`nav-menu${here ? ' is-here' : ''}`}
      data-open={open || undefined}
      data-dismissed={dismissed || undefined}
      onPointerLeave={() => setDismissed(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (open) return close()
          setOpen(true)
          setDismissed(false)
        }}
      >
        {section.label}
        <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Closes once a page is chosen, so the next page does not open with the menu showing. */}
      <ul id={id} role="list" className={`nav-panel${end ? ' nav-panel-end' : ''}`} onClick={close}>
        {section.tabs!.map(([href, label]) => (
          <li key={href}>
            <Link href={href} aria-current={current(pathname, href, here && href === tab)}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  )
}

/** The main menu, marking the section the visitor is in. */
export function MainNav({ submit }: { submit: { url: string; label: string } | null }) {
  const pathname = usePathname()
  const section = sectionOf(pathname)
  return (
    <nav aria-label="Main">
      <ul role="list">
        {SECTIONS.map((s, i) =>
          s.tabs ? (
            <NavMenu key={s.href} section={s} here={s === section} pathname={pathname} end={i === SECTIONS.length - 1} />
          ) : (
            <li key={s.href}>
              <Link href={s.href} aria-current={current(pathname, s.href, s === section)}>
                {s.label}
              </Link>
            </li>
          ),
        )}
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
