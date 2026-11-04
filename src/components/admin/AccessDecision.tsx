'use client'

import { useAuth, useConfig, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { type CSSProperties, useEffect, useState } from 'react'

import { ROLES } from '@/access/roles'

import { InviteOutcome, type InviteResult, postInvite, postJson } from './InvitePanel'

const note: CSSProperties = { margin: 0, fontSize: '0.85rem', color: 'var(--theme-elevation-600)' }

/**
 * On a waiting access request: approve it with a role, which creates the account and emails the
 * invitation, or decline it. Admins only; once decided, the status fields below say what happened.
 */
export function AccessDecision() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const { config } = useConfig()
  const router = useRouter()
  const status = useFormFields(([fields]) => fields.status?.value as string | undefined)
  const email = useFormFields(([fields]) => fields.email?.value as string | undefined)
  const [role, setRole] = useState('contributor')
  const [notify, setNotify] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approved, setApproved] = useState<InviteResult | null>(null)
  const [declined, setDeclined] = useState<{ emailed: boolean; emailError?: string } | null>(null)
  const [existing, setExisting] = useState<{ id: number; name: string } | null>(null)

  const api = `${config.serverURL}${config.routes.api}`
  const isAdmin = (user as { role?: string } | null)?.role === 'admin'

  // Someone who already has an account needs no new one; say so before anyone presses Approve.
  useEffect(() => {
    if (!isAdmin || status !== 'pending' || !email) return
    const query = new URLSearchParams({ 'where[email][equals]': email.trim().toLowerCase(), limit: '1', depth: '0' })
    fetch(`${api}/users?${query}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setExisting(json?.docs?.[0] ? { id: json.docs[0].id, name: json.docs[0].name } : null))
      .catch(() => setExisting(null))
  }, [api, email, isAdmin, status])

  if (!id || !isAdmin) return null

  const decide = async (action: 'approve' | 'decline') => {
    const question =
      action === 'approve'
        ? `Approve, create the account as ${ROLES.find((r) => r.value === role)?.label.split(' — ')[0]} and email an invitation?`
        : notify
          ? 'Decline this request and email them that it was declined?'
          : 'Decline this request? They will not be told.'
    if (!window.confirm(question)) return
    setBusy(true)
    setError(null)
    try {
      const url = `${api}/access-requests/${id}/${action}`
      if (action === 'approve') setApproved(await postInvite(url, { role }))
      else setDeclined(await postJson<{ emailed: boolean; emailError?: string }>(url, { notify }))
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (approved) {
    return (
      <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.5rem' }}>
        <p style={{ margin: 0 }}>
          <strong>Approved.</strong> Their account is created.
        </p>
        <InviteOutcome result={approved} />
      </div>
    )
  }
  if (declined) {
    return (
      <p role="status" style={{ margin: '0 0 1.5rem' }}>
        <strong>Declined.</strong>{' '}
        {declined.emailed
          ? 'They have been emailed.'
          : notify
            ? `They could not be emailed${declined.emailError ? ` (${declined.emailError})` : ' (email is not set up on this site)'}.`
            : 'They were not told.'}
      </p>
    )
  }
  if (status !== 'pending') return null

  return (
    <div role="group" aria-label="Decide on this request" style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
      <strong>Decide on this request</strong>
      {existing ? (
        <p role="alert" style={{ margin: 0 }}>
          {email} already has an account (<a href={`${config.routes.admin}/collections/users/${existing.id}`}>{existing.name}</a>). Decline
          this request; to give them a new link, open the account and send a new invitation.
        </p>
      ) : (
        <>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            Role if approved
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }} disabled={busy} onClick={() => void decide('approve')}>
            {busy ? 'Working…' : 'Approve and send invitation'}
          </button>
          <p style={note}>Creates their account and emails a link, valid for three days, to choose a password.</p>
        </>
      )}
      <hr style={{ width: '100%', margin: '0.25rem 0', border: 0, borderTop: '1px solid var(--theme-elevation-150)' }} />
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={busy} />
        <span>Email them a short note that the request was declined</span>
      </label>
      <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={busy} onClick={() => void decide('decline')}>
        Decline
      </button>
      <p style={note}>For spam, delete the request instead.</p>
      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--theme-error-500)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
