'use client'

import { useAuth, useConfig } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { type CSSProperties, useEffect, useState } from 'react'

import { ROLES } from '@/access/roles'
import { type InviteRow, MAX_BATCH, parseInviteList } from '@/lib/inviteList'

export type InviteResult = { email: string; link: string; expiresAt: string; emailed: boolean; emailError?: string }

const box: CSSProperties = { padding: '1rem 1.25rem', border: '1px solid var(--theme-elevation-150)', borderRadius: 8, display: 'grid', gap: '0.6rem' }

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.errors?.[0]?.message || `Request failed (${res.status})`)
  return json as T
}

export const postInvite = (url: string, body?: unknown) => postJson<InviteResult>(url, body)

/** What happened, and the link itself in case the email does not arrive. */
export function InviteOutcome({ result }: { result: InviteResult }) {
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
        <CopyLink link={result.link} />
      </div>
      <small style={{ color: 'var(--theme-elevation-600)' }}>The link works once. Sending a new invitation replaces it.</small>
    </div>
  )
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn btn--style-secondary btn--size-small"
      style={{ margin: 0 }}
      onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}

function RoleSelect({ value, onChange, disabled }: { value: string; onChange: (role: string) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'grid', gap: '0.25rem' }}>
      Role
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  )
}

type Sending = { state: 'sending' } | { state: 'sent'; result: InviteResult } | { state: 'failed'; message: string }

const cell: CSSProperties = { padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--theme-elevation-150)', textAlign: 'left', verticalAlign: 'top' }

function RowStatus({ row, sending }: { row: InviteRow; sending?: Sending }) {
  if (row.problem) return <span style={{ color: 'var(--theme-error-500)' }}>{row.problem}</span>
  if (!sending) return <span style={{ color: 'var(--theme-elevation-600)' }}>Ready</span>
  if (sending.state === 'sending') return <span>Sending…</span>
  if (sending.state === 'failed') return <span style={{ color: 'var(--theme-error-500)' }}>{sending.message}</span>
  if (sending.result.emailed) return <span>Emailed</span>
  return (
    <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      Not emailed{sending.result.emailError ? ` (${sending.result.emailError})` : ''}; send the link yourself <CopyLink link={sending.result.link} />
    </span>
  )
}

/**
 * Invite a list of people at once: paste one person per line, from an email or a spreadsheet, check
 * the list, then send. Invitations go one at a time, so each row shows its own outcome.
 */
function InviteMany({ url, onClose, onSent }: { url: string; onClose: () => void; onSent: () => void }) {
  const [text, setText] = useState('')
  const [role, setRole] = useState('contributor')
  const [sending, setSending] = useState<Record<string, Sending> | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = parseInviteList(text)
  const ready = rows.filter((r) => !r.problem)
  const roleName = ROLES.find((r) => r.value === role)?.label.split(' — ')[0] ?? role

  const send = async () => {
    if (!window.confirm(`Send ${ready.length} invitation${ready.length === 1 ? '' : 's'}, each as ${roleName}?`)) return
    setBusy(true)
    const progress: Record<string, Sending> = {}
    const show = () => setSending({ ...progress })
    for (const row of ready) {
      progress[row.email] = { state: 'sending' }
      show()
      try {
        progress[row.email] = { state: 'sent', result: await postInvite(url, { name: row.name, email: row.email, role }) }
      } catch (e) {
        progress[row.email] = { state: 'failed', message: (e as Error).message }
      }
      show()
    }
    setBusy(false)
    onSent()
  }

  const outcomes = sending ? Object.values(sending) : []
  const count = (test: (s: Sending) => boolean) => outcomes.filter(test).length
  const done = sending && !busy

  return (
    <div role="group" aria-label="Invite several people" style={box}>
      <strong>Invite several people</strong>
      <p style={{ margin: 0, color: 'var(--theme-elevation-600)' }}>
        Paste one person per line: a name and an email address, in any order, for example <code>Ann Lee, ann@miamioh.edu</code>. Rows copied
        from a spreadsheet work too. Everyone gets the same role, and an email with a link, valid for three days, to choose their own password.
        Up to {MAX_BATCH} at a time.
      </p>
      <label style={{ display: 'grid', gap: '0.25rem' }}>
        People
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={!!sending}
          rows={8}
          spellCheck={false}
          placeholder={'Ann Lee, ann@miamioh.edu\nBo Chen <chenb@miamioh.edu>'}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
        />
      </label>
      <div style={{ maxWidth: '24rem' }}>
        <RoleSelect value={role} onChange={setRole} disabled={!!sending} />
      </div>
      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <caption style={{ textAlign: 'left', marginBottom: '0.4rem' }}>
            {ready.length} of {rows.length} line{rows.length === 1 ? '' : 's'} ready to send
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ ...cell, width: '3.5rem' }}>Line</th>
              <th scope="col" style={cell}>Name</th>
              <th scope="col" style={cell}>Email</th>
              <th scope="col" style={cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.line}>
                <td style={cell}>{row.line}</td>
                <td style={cell}>{row.name || '—'}</td>
                <td style={cell}>{row.email || '—'}</td>
                <td style={cell}>
                  <RowStatus row={row} sending={row.problem ? undefined : sending?.[row.email]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {done && (
        <p role="status" style={{ margin: 0 }}>
          <strong>Done.</strong> {count((s) => s.state === 'sent' && s.result.emailed)} emailed
          {count((s) => s.state === 'sent' && !s.result.emailed) ? `, ${count((s) => s.state === 'sent' && !s.result.emailed)} to send by hand` : ''}
          {count((s) => s.state === 'failed') ? `, ${count((s) => s.state === 'failed')} not invited (see the list)` : ''}.
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {!sending ? (
          <button type="button" className="btn btn--style-primary btn--size-small" style={{ margin: 0 }} disabled={!ready.length} onClick={() => void send()}>
            {ready.length ? `Send ${ready.length} invitation${ready.length === 1 ? '' : 's'}` : 'Send invitations'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--style-secondary btn--size-small"
            style={{ margin: 0 }}
            disabled={busy}
            onClick={() => {
              setSending(null)
              setText('')
            }}
          >
            Invite more people
          </button>
        )}
        <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

/** How many people are waiting for an answer to their request to join, with a link to them. */
function WaitingRequests() {
  const { config } = useConfig()
  const [waiting, setWaiting] = useState(0)
  useEffect(() => {
    const query = new URLSearchParams({ 'where[status][equals]': 'pending', limit: '1', depth: '0' })
    fetch(`${config.serverURL}${config.routes.api}/access-requests?${query}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setWaiting(json?.totalDocs ?? 0))
      .catch(() => setWaiting(0))
  }, [config.serverURL, config.routes.api])
  if (!waiting) return null
  return (
    <p role="status" style={{ margin: 0, padding: '0.75rem 1rem', borderRadius: 8, background: 'var(--theme-elevation-50)' }}>
      <strong>
        {waiting} {waiting === 1 ? 'person has' : 'people have'} asked to join.
      </strong>{' '}
      <a href={`${config.routes.admin}/collections/access-requests?${new URLSearchParams({ 'where[status][equals]': 'pending' })}`}>
        Review the request{waiting === 1 ? '' : 's'}
      </a>
    </p>
  )
}

/**
 * Above the Users list: invite someone by name, email and role, or several people at once. They
 * receive an email with a link, valid for three days, to choose their own password. Admins only.
 */
export function InvitePanel() {
  const { user } = useAuth()
  const { config } = useConfig()
  const router = useRouter()
  const [mode, setMode] = useState<'one' | 'many' | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('contributor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<InviteResult | null>(null)

  if ((user as { role?: string } | null)?.role !== 'admin') return null

  const url = `${config.serverURL}${config.routes.api}/users/invite`
  const submit = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const r = await postInvite(url, { name, email, role })
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
      <WaitingRequests />
      {mode === null && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }} onClick={() => setMode('one')}>
            Invite someone
          </button>
          <button type="button" className="btn btn--style-secondary btn--size-medium" style={{ margin: 0 }} onClick={() => setMode('many')}>
            Invite several people
          </button>
        </div>
      )}
      {mode === 'many' && <InviteMany url={url} onClose={() => setMode(null)} onSent={() => router.refresh()} />}
      {mode === 'one' && (
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
            <RoleSelect value={role} onChange={setRole} />
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
            <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} onClick={() => setMode(null)}>
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
