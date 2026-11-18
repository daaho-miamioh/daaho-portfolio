import Link from 'next/link'

/** In the admin's menu: the way back to the website, where signed-in staff also see drafts. */
export function WebsiteLink() {
  return (
    <Link className="nav__link" href="/" style={{ marginTop: '1rem' }}>
      <span className="nav__link-label">Go to the website</span>
    </Link>
  )
}
