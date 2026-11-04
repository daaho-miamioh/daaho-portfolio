'use client'

import { useRef, useState } from 'react'

import { type Application, type ApplicationErrors, checkApplication, LIMITS, REQUEST_KINDS } from '@/lib/accessRequests'

const EMPTY: Application = { name: '', email: '', affiliation: '', kind: '', reason: '' }
const ORDER: (keyof Application)[] = ['name', 'email', 'affiliation', 'kind', 'reason']

/** The form on /join. Checked here as on the server; the server's answer is the one that counts. */
export function JoinForm() {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<ApplicationErrors>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const trap = useRef<HTMLInputElement>(null)
  const done = useRef<HTMLDivElement>(null)

  const set = (key: keyof Application) => (e: { target: { value: string } }) => {
    setForm({ ...form, [key]: e.target.value })
    if (errors[key]) setErrors({ ...errors, [key]: undefined })
  }

  const showErrors = (found: ApplicationErrors) => {
    setErrors(found)
    const first = ORDER.find((key) => found[key])
    if (first) document.getElementById(`join-${first}`)?.focus()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProblem(null)
    const { errors: found } = checkApplication(form)
    if (Object.keys(found).length) return showErrors(found)
    setBusy(true)
    try {
      const res = await fetch('/api/access-requests/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, website: trap.current?.value ?? '' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const fields = json?.errors?.[0]?.data?.fields as ApplicationErrors | undefined
        if (fields) showErrors(fields)
        setProblem(json?.errors?.[0]?.message || 'Your request could not be sent. Please try again later.')
        return
      }
      setSentTo(form.email.trim())
      setTimeout(() => done.current?.focus(), 0)
    } catch {
      setProblem('Your request could not be sent. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div ref={done} tabIndex={-1} role="status" className="join-done">
        <h2>Thank you</h2>
        <p>
          Your request has reached the project team. If it is approved, an email from DAAHO will come to <strong>{sentTo}</strong> with a link
          to set your password.
        </p>
      </div>
    )
  }

  const field = (key: keyof Application) => ({
    id: `join-${key}`,
    value: form[key],
    onChange: set(key),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `join-${key}-error` : undefined,
  })
  const error = (key: keyof Application) =>
    errors[key] && (
      <p id={`join-${key}-error`} className="join-error">
        {errors[key]}
      </p>
    )

  return (
    <form className="join-form" onSubmit={(e) => void submit(e)} noValidate>
      <div className="join-field">
        <label htmlFor="join-name">Your name</label>
        <input {...field('name')} autoComplete="name" maxLength={LIMITS.name} />
        {error('name')}
      </div>
      <div className="join-field">
        <label htmlFor="join-email">Email</label>
        <input {...field('email')} type="email" autoComplete="email" maxLength={LIMITS.email} />
        {error('email')}
      </div>
      <div className="join-field">
        <label htmlFor="join-affiliation">
          Institution or community <span className="join-optional">(optional)</span>
        </label>
        <input {...field('affiliation')} autoComplete="organization" maxLength={LIMITS.affiliation} />
        {error('affiliation')}
      </div>
      <div className="join-field">
        <label htmlFor="join-kind">Which describes you best?</label>
        <select {...field('kind')}>
          <option value="">Choose one</option>
          {REQUEST_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        {error('kind')}
      </div>
      <div className="join-field">
        <label htmlFor="join-reason">What would you like to do?</label>
        <p id="join-reason-hint" className="join-hint">
          For example: review transcriptions, research a family history, or help with a class project.
        </p>
        <textarea
          {...field('reason')}
          aria-describedby={[errors.reason ? 'join-reason-error' : '', 'join-reason-hint'].filter(Boolean).join(' ')}
          rows={5}
          maxLength={LIMITS.reason}
        />
        {error('reason')}
      </div>
      {/* Hidden from people and screen readers; a bot that fills it in is ignored. */}
      <div className="join-trap" aria-hidden="true">
        <label htmlFor="join-website">Website</label>
        <input ref={trap} id="join-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {problem && (
        <p role="alert" className="join-problem">
          {problem}
        </p>
      )}
      <div>
        <button type="submit" className="button" disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </form>
  )
}
