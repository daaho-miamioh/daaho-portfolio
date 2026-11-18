'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ANNOTATION_CATEGORIES } from '@/lib/annotationCategories'

declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback?: (t: string) => void; 'expired-callback'?: () => void }) => number
      reset: (id?: number) => void
    }
    __daahoRecaptchaReady?: () => void
  }
}

type Picked = { quote: string; start: number; top: number; left: number }
type Fields = { category: string; body: string; name: string; email: string }
const EMPTY: Fields = { category: 'context', body: '', name: '', email: '' }

/**
 * Where a selection sits in the transcript, counting only the transcript's own text: the "Play from"
 * labels and annotation numbers the page adds are marked data-skip and left out, so the offsets and
 * the quoted text match the stored transcript exactly.
 */
function selectionIn(container: HTMLElement): { quote: string; start: number; rect: DOMRect } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null
  let pos = 0
  let start = -1
  let end = -1
  const parts: string[] = []
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (n.parentElement?.closest('[data-skip]')) continue
    if (start < 0) {
      if (n === range.startContainer) start = pos + range.startOffset
      else if (range.comparePoint(n, 0) === 0) start = pos
    }
    if (end < 0) {
      if (n === range.endContainer) end = pos + range.endOffset
      else if (range.comparePoint(n, 0) === 1) end = pos
    }
    parts.push(n.data)
    pos += n.data.length
  }
  if (start < 0) return null
  if (end < 0) end = pos
  const text = parts.join('')
  let quote = text.slice(start, end)
  const lead = quote.length - quote.trimStart().length
  quote = quote.trim()
  if (!quote) return null
  return { quote, start: start + lead, rect: range.getBoundingClientRect() }
}

let scriptLoading: Promise<void> | null = null
function loadRecaptcha(): Promise<void> {
  if (window.grecaptcha?.render) return Promise.resolve()
  scriptLoading ??= new Promise((resolve, reject) => {
    window.__daahoRecaptchaReady = () => resolve()
    const s = document.createElement('script')
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=__daahoRecaptchaReady'
    s.async = true
    s.onerror = () => {
      scriptLoading = null
      reject(new Error('reCAPTCHA did not load'))
    }
    document.head.appendChild(s)
  })
  return scriptLoading
}

/**
 * On a public transcript: select a passage and suggest a note on it. The note goes to the project's
 * editors and appears only once one of them approves it. Visitors tick reCAPTCHA's "I'm not a robot";
 * Google's script is fetched only when the form opens.
 */
export function SuggestAnnotation({ itemId, targetId, siteKey, signedIn }: { itemId: number; targetId: string; siteKey: string | null; signedIn: boolean }) {
  const [picked, setPicked] = useState<Picked | null>(null)
  const [quote, setQuote] = useState<{ text: string; start: number } | null>(null)
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Fields | 'quote', string>>>({})
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const captchaBox = useRef<HTMLDivElement>(null)
  const widget = useRef<number | null>(null)
  const trap = useRef<HTMLInputElement>(null)
  const needCaptcha = !signedIn && !!siteKey

  const check = useCallback(() => {
    const container = document.getElementById(targetId)
    if (!container) return
    const found = selectionIn(container)
    if (!found) return setPicked(null)
    const { rect } = found
    // Fixed to the viewport just under the selection; recomputed as the page scrolls.
    if (rect.bottom < 0 || rect.top > window.innerHeight) return setPicked(null)
    setPicked({ quote: found.quote, start: found.start, top: Math.min(rect.bottom + 8, window.innerHeight - 56), left: Math.min(Math.max(16, rect.left), window.innerWidth - 200) })
  }, [targetId])

  useEffect(() => {
    const onUp = () => setTimeout(check, 0)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('keyup', onUp)
    document.addEventListener('touchend', onUp)
    window.addEventListener('scroll', onUp, { passive: true })
    window.addEventListener('resize', onUp)
    return () => {
      window.removeEventListener('scroll', onUp)
      window.removeEventListener('resize', onUp)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('keyup', onUp)
      document.removeEventListener('touchend', onUp)
    }
  }, [check])

  const open = async () => {
    if (!picked) return
    setQuote({ text: picked.quote, start: picked.start })
    setPicked(null)
    setSent(false)
    setProblem(null)
    setErrors({})
    setToken(null)
    dialog.current?.showModal()
    if (!needCaptcha) return
    try {
      await loadRecaptcha()
      if (captchaBox.current && widget.current == null && window.grecaptcha) {
        widget.current = window.grecaptcha.render(captchaBox.current, {
          sitekey: siteKey!,
          callback: (t) => setToken(t),
          'expired-callback': () => setToken(null),
        })
      } else if (widget.current != null) {
        window.grecaptcha?.reset(widget.current)
      }
    } catch {
      setProblem('The "I\'m not a robot" check could not load. Check your connection and try again.')
    }
  }

  const close = () => dialog.current?.close()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quote) return
    setProblem(null)
    const found: typeof errors = {}
    if (fields.body.trim().length < 5) found.body = 'Write your note.'
    if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) found.email = 'Check the email address, or leave it empty.'
    if (Object.keys(found).length) return setErrors(found)
    if (needCaptcha && !token) return setProblem('Please tick "I\'m not a robot".')
    setBusy(true)
    try {
      const res = await fetch('/api/annotations/suggest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: itemId, quote: quote.text, start: quote.start, ...fields, recaptcha: token, website: trap.current?.value ?? '' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const f = json?.errors?.[0]?.data?.fields
        if (f) setErrors(f)
        setProblem(json?.errors?.[0]?.message || 'Your note could not be sent. Please try again later.')
        if (widget.current != null) window.grecaptcha?.reset(widget.current)
        setToken(null)
        return
      }
      setSent(true)
      setFields(EMPTY)
    } catch {
      setProblem('Your note could not be sent. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => {
    setFields({ ...fields, [key]: e.target.value })
    if (errors[key]) setErrors({ ...errors, [key]: undefined })
  }

  return (
    <>
      <p className="transcript-note suggest-hint">Know something about this document? Select a passage in the transcript to suggest a note.</p>
      {picked && (
        <button type="button" className="button suggest-button" style={{ top: picked.top, left: picked.left }} onMouseDown={(e) => e.preventDefault()} onClick={() => void open()}>
          Suggest a note
        </button>
      )}
      <dialog ref={dialog} className="suggest-dialog" aria-labelledby="suggest-heading" onClose={() => setQuote(null)}>
        {sent ? (
          <div role="status">
            <h2 id="suggest-heading">Thank you</h2>
            <p>Your note has reached the project team. It will appear here once an editor has checked it.</p>
            <button type="button" className="button" onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <form className="join-form" onSubmit={(e) => void submit(e)} noValidate>
            <h2 id="suggest-heading">Suggest a note on this passage</h2>
            <blockquote className="suggest-quote">{quote && quote.text.length > 400 ? `${quote.text.slice(0, 400)}…` : quote?.text}</blockquote>
            {errors.quote && <p className="join-error">{errors.quote}</p>}
            <div className="join-field">
              <label htmlFor="suggest-category">What kind of note?</label>
              <select id="suggest-category" value={fields.category} onChange={set('category')}>
                {ANNOTATION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="join-field">
              <label htmlFor="suggest-body">Your note</label>
              <p id="suggest-body-hint" className="join-hint">
                For example: who a person is, where a place was, a better reading of a word, or context a reader should know.
              </p>
              <textarea
                id="suggest-body"
                rows={5}
                maxLength={2000}
                value={fields.body}
                onChange={set('body')}
                aria-invalid={errors.body ? true : undefined}
                aria-describedby={['suggest-body-hint', errors.body ? 'suggest-body-error' : ''].filter(Boolean).join(' ')}
              />
              {errors.body && (
                <p id="suggest-body-error" className="join-error">
                  {errors.body}
                </p>
              )}
            </div>
            {!signedIn && (
              <>
                <div className="join-field">
                  <label htmlFor="suggest-name">
                    Your name <span className="join-optional">(optional)</span>
                  </label>
                  <input id="suggest-name" autoComplete="name" maxLength={100} value={fields.name} onChange={set('name')} />
                </div>
                <div className="join-field">
                  <label htmlFor="suggest-email">
                    Email <span className="join-optional">(optional; only project staff see it, in case they have a question)</span>
                  </label>
                  <input
                    id="suggest-email"
                    type="email"
                    autoComplete="email"
                    maxLength={200}
                    value={fields.email}
                    onChange={set('email')}
                    aria-invalid={errors.email ? true : undefined}
                  />
                  {errors.email && <p className="join-error">{errors.email}</p>}
                </div>
              </>
            )}
            {/* Hidden from people and screen readers; a bot that fills it in is ignored. */}
            <div className="join-trap" aria-hidden="true">
              <label htmlFor="suggest-website">Website</label>
              <input ref={trap} id="suggest-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>
            {needCaptcha && (
              <div>
                <div ref={captchaBox} />
                <p className="join-hint">This check uses Google reCAPTCHA; Google&rsquo;s privacy policy and terms apply.</p>
              </div>
            )}
            {!signedIn && !siteKey && <p className="join-hint suggest-dev">reCAPTCHA appears here once its keys are set (development only).</p>}
            {problem && (
              <p role="alert" className="join-problem">
                {problem}
              </p>
            )}
            <div className="suggest-actions">
              <button type="submit" className="button" disabled={busy}>
                {busy ? 'Sending…' : 'Send for review'}
              </button>
              <button type="button" className="button-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
