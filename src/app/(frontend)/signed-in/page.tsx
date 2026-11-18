import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getViewer } from '@/lib/viewer'
import type { User } from '@/payload-types'

export const metadata = { title: 'Signed in', robots: { index: false, follow: false } }

/** Where signing in leads (see src/proxy.ts): the website, with drafts and staff tools, or the admin. */
export default async function SignedInPage() {
  const { user } = await getViewer()
  if (!user) redirect('/admin/login?redirect=/signed-in')
  const { name, role } = user as User
  const canReview = role === 'admin' || role === 'editor'

  return (
    <div className="signed-in">
      <p className="eyebrow">Signed in</p>
      <h1>Welcome, {name}</h1>
      <p className="lede">Where would you like to go?</p>
      <div className="choice-grid">
        <Link href="/" className="choice-card">
          <h2>The website</h2>
          <p>
            The site as visitors see it, with drafts shown too. Correct a transcript on its item page
            {canReview ? ', and review visitors’ notes and duplicate people.' : '.'}
          </p>
          <span className="choice-go">
            Go to the website <span aria-hidden>→</span>
          </span>
        </Link>
        <Link href="/admin" className="choice-card">
          <h2>The admin</h2>
          <p>
            {canReview
              ? 'Add and edit records, upload scans and recordings, publish items, and manage accounts.'
              : 'Add and edit records, and upload scans and recordings. An editor publishes your changes.'}
          </p>
          <span className="choice-go">
            Go to the admin <span aria-hidden>→</span>
          </span>
        </Link>
      </div>
      <p className="muted">
        You can switch at any time: the black Staff bar at the top of the website links to the admin, and the admin&rsquo;s
        menu links back to the website.
      </p>
    </div>
  )
}
