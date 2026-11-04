import type { Metadata } from 'next'
import Link from 'next/link'

import { JoinForm } from '@/components/JoinForm'
import { getViewer } from '@/lib/viewer'

export const metadata: Metadata = {
  title: 'Join the project',
  description: 'Ask to join the DAAHO project team: students, researchers, librarians and community partners who help describe the collection.',
}

/**
 * Accounts are by invitation; this is how someone outside the team asks for one. An admin approves or
 * declines each request (Admin → Access requests), and Site settings can close the form.
 */
export default async function JoinPage() {
  const { payload, user } = await getViewer()
  const [settings, home] = await Promise.all([
    payload.findGlobal({ slug: 'settings', depth: 0 }),
    payload.findGlobal({ slug: 'home', depth: 0, overrideAccess: false, user }),
  ])
  const open = settings.acceptAccessRequests !== false
  const submit = home.submitLink?.url

  return (
    <div className="join">
      <section>
        <p className="eyebrow">Join the project</p>
        <h1>Ask to join the DAAHO team</h1>
        <div className="lede">
          <p>
            Students, researchers, librarians and community partners help describe and review the letters, records and recordings in this
            collection. If you would like to take part, tell us a little about yourself.
          </p>
        </div>
        <h2 className="join-subhead">What happens next</h2>
        <ol className="join-steps">
          <li>A project administrator reads your request.</li>
          <li>If it is approved, you get an email from DAAHO with a link to set your password. The link is valid for three days.</li>
          <li>You sign in at the staff sign-in page and start working with the team.</li>
        </ol>
        <p className="muted">
          You do not need an account to explore the collection: <Link href="/items">browse the items</Link>.
          {submit && (
            <>
              {' '}
              To share documents or photographs from your family or community, <a href={submit}>submit a collection</a> instead.
            </>
          )}
        </p>
        {user && <p className="muted">You are already signed in, so you are on the team.</p>}
      </section>
      <section aria-label="Request form">
        {open ? (
          <>
            <JoinForm />
            <p className="join-privacy">
              Only the project&rsquo;s administrators see what you send here, and they use it only to answer your request.
            </p>
          </>
        ) : (
          <div className="notice notice-unreviewed">
            <p>Requests to join are closed at the moment. Please check back later.</p>
          </div>
        )}
      </section>
    </div>
  )
}
