'use client'

import { useAuth, useConfig, useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

import { InviteOutcome, type InviteResult, postInvite } from './InvitePanel'

/** On a user's page: send a fresh invitation link, e.g. when the last one expired. Admins only. */
export function InviteButton() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const { config } = useConfig()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InviteResult | null>(null)

  if (!id || (user as { role?: string } | null)?.role !== 'admin' || user?.id === id) return null

  const send = async () => {
    if (!window.confirm('Send a new invitation? Any earlier link stops working.')) return
    setBusy(true)
    setError(null)
    try {
      setResult(await postInvite(`${config.serverURL}${config.routes.api}/users/${id}/invite`))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.5rem' }}>
      <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={busy} onClick={() => void send()}>
        {busy ? 'Sending…' : 'Send a new invitation'}
      </button>
      <small style={{ color: 'var(--theme-elevation-600)' }}>Emails a link, valid for three days, to choose a new password.</small>
      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--theme-error-500)' }}>
          {error}
        </p>
      )}
      {result && <InviteOutcome result={result} />}
    </div>
  )
}
