'use client'

import { useAuth, useConfig } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { type CSSProperties, useState } from 'react'

import { ROLES } from '@/access/roles'

export type InviteResult = { email: string; link: string; expiresAt: string; emailed: boolean; emailError?: string }

const box: CSSProperties = { padding: '1rem 1.25rem', border: '1px solid var(--theme-elevation-150)', borderRadius: 8, display: 'grid', gap: '0.6rem' }

export async function postInvite(url: string, body?: unknown): Promise<InviteResult> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.errors?.[0]?.message || `Request failed (${res.status})`)
  return json as InviteResult
}

/** What happened, and the link itself in case the email does not arrive. */
export function InviteOutcome({ result }: { result: InviteResult }) {
  const [copied, setCopied] = useState(false)
  const until = new Date(result.expiresAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <div role="status" style={{ ...box, background: 'var(--theme-elevation-50)' }}>
      {result.emailed ? (
        <p style={{ margin: 0 }}>
          <strong>Invitation emailed to {result.email}.</strong> The link expires {until}.
        </p>
      ) : (
        <p style={{ margin: 0 }}>
          <strong>{result.emailError ? 'The email could not be sent' : 'Email is not set up on this site yet'}</strong>
          {result.emailError ? ` (${result.emailError})` : ''}. Send this link to {result.email} yourself — it expires {until}:
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ wordBreak: 'break-all', fontSize: '0.8rem', flex: '1 1 20rem' }}>{result.link}</code>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          style={{ margin: 0 }}
          onClick={() => navigator.clipboard.writeText(result.link).then(() => setCopied(true))}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <small style={{ color: 'var(--theme-elevation-600)' }}>The link works once. Sending a new invitation replaces it.</small>
    </div>
  )
}

/**
 * Above the Users list: invite someone by name, email and role. They receive an email with a link,
 * valid for three days, to choose their own password. Admins only.
 */
export function InvitePanel() {
  const { user } = useAuth()
  const { config } = useConfig()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('contributor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InviteResult | null>(null)

  if ((user as { role?: string } | null)?.role !== 'admin') return null

  const submit = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const r = await postInvite(`${config.serverURL}${config.routes.api}/users/invite`, { name, email, role })
      setResult(r)
      setName('')
      setEmail('')
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ margin: '0 0 1.5rem', display: 'grid', gap: '0.75rem' }}>
      {!open ? (
        <div>
          <button type="button" className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }} onClick={() => setOpen(true)}>
            Invite someone
          </button>
        </div>
      ) : (
        <div role="group" aria-label="Invite someone" style={box}>
          <strong>Invite someone</strong>
          <p style={{ margin: 0, color: 'var(--theme-elevation-600)' }}>
            They get an email with a link, valid for three days, to choose their own password.
          </p>
          <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn--style-primary btn--size-small"
              style={{ margin: 0 }}
              disabled={busy || !name.trim() || !email.trim()}
              onClick={() => void submit()}
            >
              {busy ? 'Sending…' : 'Send invitation'}
            </button>
            <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {error && (
            <p role="alert" style={{ margin: 0, color: 'var(--theme-error-500)' }}>
              {error}
            </p>
          )}
        </div>
      )}
      {result && <InviteOutcome result={result} />}
    </div>
  )
}
