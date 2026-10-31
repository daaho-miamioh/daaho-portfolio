/**
 * The site's sections: the main menu, and the tabs shown under the header on a section's pages.
 * `paths` are pages that belong to a section without having a tab of their own.
 */
export type Section = {
  href: string
  label: string
  tabs?: readonly (readonly [href: string, label: string])[]
  paths?: readonly string[]
}

export const SECTIONS: readonly Section[] = [
  {
    href: '/collection',
    label: 'Collection',
    tabs: [
      ['/collection', 'Collections'],
      ['/items', 'Items'],
      ['/people', 'People'],
      ['/places', 'Places'],
      ['/subjects', 'Subjects'],
      ['/timeline', 'Timeline'],
    ],
    paths: ['/genres'],
  },
  { href: '/stories', label: 'Stories' },
  {
    href: '/about',
    label: 'About',
    tabs: [
      ['/about', 'The project'],
      ['/about/team', 'Team'],
      ['/events', 'Events'],
      ['/harmful-language', 'Statement on harmful language'],
    ],
  },
]

const under = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`)

export function sectionOf(pathname: string): Section | undefined {
  return SECTIONS.find((s) => [s.href, ...(s.tabs ?? []).map(([href]) => href), ...(s.paths ?? [])].some((p) => under(pathname, p)))
}

/** The tab a page comes under: the longest matching path, so /about/team is Team, not The project. */
export function tabOf(section: Section, pathname: string): string | undefined {
  return (section.tabs ?? [])
    .map(([href]) => href)
    .filter((href) => under(pathname, href))
    .sort((a, b) => b.length - a.length)[0]
}
