'use client'

import { useState } from 'react'

/** Sign out from the website's Staff bar, and stay on the website as a visitor. */
export function SignOutButton() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="staff-signout"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => null)
        // A full page load, so nothing rendered for a signed-in viewer (drafts, staff tools) stays on screen.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/')
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
