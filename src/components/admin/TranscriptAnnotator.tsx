'use client'

import { useAuth, useConfig, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { contextAround, locate, segment } from '@/lib/anchors'

type Status = 'draft' | 'submitted' | 'approved' | 'rejected'
type UserRef = number | { id: number; name?: string; email?: string } | null | undefined
type Annotation = {
  id: number
  quote: string
  prefix?: string | null
  suffix?: string | null
  start?: number | null
  category: string
  body: string
  status: Status
  reviewNote?: string | null
  author?: UserRef
  lastEditedBy?: UserRef
  reviewedBy?: UserRef
}
type Selection = { start: number; end: number; quote: string }

const CATEGORIES = [
  ['context', 'Context'],
  ['person', 'Person'],
  ['place', 'Place'],
  ['translation', 'Translation'],
  ['correction', 'Correction'],
  ['harmful-language', 'Harmful language'],
  ['other', 'Other'],
] as const

// Colour plus a distinct underline, so status does not depend on colour alone.
const LOOK: Record<Status, { label: string; mark: CSSProperties }> = {
  draft: { label: 'Draft', mark: { background: 'rgba(128,128,128,.22)', borderBottom: '2px dotted rgb(110,110,110)' } },
  submitted: { label: 'Awaiting review', mark: { background: 'rgba(230,160,0,.25)', borderBottom: '2px dashed rgb(180,120,0)' } },
  approved: { label: 'Approved — public', mark: { background: 'rgba(30,150,70,.22)', borderBottom: '2px solid rgb(20,120,50)' } },
  rejected: { label: 'Returned', mark: { background: 'rgba(200,40,40,.18)', borderBottom: '2px double rgb(170,30,30)' } },
}

const idOf = (u: UserRef) => (u && typeof u === 'object' ? u.id : (u ?? null))
const nameOf = (u: UserRef) => (u && typeof u === 'object' ? u.name || u.email || `User ${u.id}` : u ? `User ${u}` : '—')

async function call(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.errors?.[0]?.message || json?.message || `Request failed (${res.status})`)
  return json
}

/** Character offsets of the current selection within `container`, trimmed of surrounding whitespace. */
function selectionIn(container: HTMLElement, text: string): Selection | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const r = sel.getRangeAt(0)
  if (!container.contains(r.startContainer) || !container.contains(r.endContainer)) return null
  const pre = document.createRange()
  pre.selectNodeContents(container)
  pre.setEnd(r.startContainer, r.startOffset)
  let start = pre.toString().length
  let end = start + r.toString().length
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  return end > start ? { start, end, quote: text.slice(start, end) } : null
}

/**
 * The Annotations tab of the item editor: select a passage of the saved transcript and attach a note.
 * Notes go to review; an editor or admin other than the author approves them before they are public.
 */
export function TranscriptAnnotator() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const { config } = useConfig()
  const api = `${config.serverURL}${config.routes.api}`
  const formTranscript = useFormFields(([fields]) => (fields.transcript?.value as string | undefined) ?? '')

  const [saved, setSaved] = useState<string | null>(null)
  const [notes, setNotes] = useState<Annotation[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [category, setCategory] = useState('context')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState<number | null>(null)
  const textRef = useRef<HTMLDivElement>(null)

  const role = (user as { role?: string } | null)?.role
  const isEditor = role === 'admin' || role === 'editor'

  // Bumped after every change to fetch the transcript and annotations again.
  const [version, setVersion] = useState(0)
  const load = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!id) return
    let live = true
    Promise.all([
      call(`${api}/items/${id}?depth=0&draft=true`),
      call(`${api}/annotations?where[item][equals]=${id}&limit=500&depth=1&sort=start`),
    ])
      .then(([item, list]) => {
        if (!live) return
        setSaved(item.transcript ?? '')
        setNotes(list.docs)
      })
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [api, id, version])

  const placed = useMemo(() => {
    if (saved == null) return { segments: [], unplaced: [] as number[], ranges: new Map<number, { start: number; end: number }>() }
    const ranges = new Map<number, { start: number; end: number }>()
    for (const n of notes) {
      const r = locate(saved, n)
      if (r) ranges.set(n.id, r)
    }
    const { segments, unplaced } = segment(saved, [...ranges].map(([nid, r]) => ({ ...r, id: nid })))
    return { segments, unplaced: [...unplaced, ...notes.filter((n) => !ranges.has(n.id)).map((n) => n.id)], ranges }
  }, [saved, notes])

  if (!id) return <p style={{ padding: '1rem 0' }}>Save the item first, then come back to annotate its transcript.</p>
  if (saved == null) return <p style={{ padding: '1rem 0' }}>{error ?? 'Loading transcript…'}</p>

  const dirty = formTranscript !== saved
  const byId = new Map(notes.map((n) => [n.id, n]))

  const onSelect = () => {
    if (dirty || !textRef.current) return
    const s = selectionIn(textRef.current, saved)
    if (!s) return
    const overlaps = [...placed.ranges.values()].some((r) => s.start < r.end && r.start < s.end)
    if (overlaps) {
      setError('That passage overlaps an existing annotation. Select different text, or edit the existing note.')
      setSelection(null)
      return
    }
    setError(null)
    setSelection(s)
  }

  const create = async (status: Status) => {
    if (!selection || !body.trim()) return
    setBusy(true)
    setError(null)
    try {
      await call(`${api}/annotations`, {
        method: 'POST',
        body: JSON.stringify({
          item: id,
          quote: selection.quote,
          start: selection.start,
          ...contextAround(saved, selection.start, selection.end),
          category,
          body: body.trim(),
          status,
        }),
      })
      setSelection(null)
      setBody('')
      window.getSelection()?.removeAllRanges()
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const act = async (n: Annotation, change: Partial<Annotation> | 'delete') => {
    setBusy(true)
    setError(null)
    try {
      if (change === 'delete') await call(`${api}/annotations/${n.id}`, { method: 'DELETE' })
      else await call(`${api}/annotations/${n.id}`, { method: 'PATCH', body: JSON.stringify(change) })
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const returnWithNote = (n: Annotation) => {
    const note = window.prompt('Why is this being returned? The author will see this note.')
    if (note === null) return
    void act(n, { status: 'rejected', reviewNote: note })
  }

  const canReview = (n: Annotation) =>
    isEditor && n.status === 'submitted' && user?.id !== idOf(n.author) && user?.id !== idOf(n.lastEditedBy)
  const ownsDraft = (n: Annotation) => user?.id === idOf(n.author) && n.status !== 'approved'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(280px, 2fr)', gap: '1.5rem', padding: '1rem 0' }}>
      <div>
        <p style={{ margin: '0 0 .5rem', color: 'var(--theme-elevation-600)' }}>
          Select a passage to annotate. Annotations are public only after an editor or admin other than the author approves them.
        </p>
        <p style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '0 0 .75rem', fontSize: '.85rem' }}>
          {(Object.keys(LOOK) as Status[]).map((s) => (
            <span key={s}>
              <span style={{ ...LOOK[s].mark, padding: '0 .3em' }}>abc</span> {LOOK[s].label}
            </span>
          ))}
        </p>
        {dirty && (
          <p role="status" style={{ padding: '.5rem .75rem', background: 'var(--theme-warning-100)', borderRadius: 4 }}>
            The transcript has unsaved changes. Save the item first — annotations are anchored to the saved text.
          </p>
        )}
        {!saved && <p>This item has no transcript yet.</p>}
        <div
          ref={textRef}
          // Read the selection a tick later: the browser may still be finishing it when mouseup fires.
          onMouseUp={() => setTimeout(onSelect, 0)}
          onKeyUp={() => setTimeout(onSelect, 0)}
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: '.9rem',
            lineHeight: 1.7,
            padding: '1rem',
            border: '1px solid var(--theme-elevation-150)',
            borderRadius: 4,
            maxHeight: '70vh',
            overflowY: 'auto',
            opacity: dirty ? 0.6 : 1,
          }}
        >
          {placed.segments.map((s, i) => {
            const n = s.id != null ? byId.get(s.id) : undefined
            if (!n) return <span key={i}>{s.text}</span>
            return (
              <mark
                key={i}
                id={`ann-text-${n.id}`}
                title={`${LOOK[n.status].label}: ${n.body}`}
                onClick={() => {
                  setFocus(n.id)
                  document.getElementById(`ann-card-${n.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                }}
                style={{ ...LOOK[n.status].mark, color: 'inherit', cursor: 'pointer', outline: focus === n.id ? '2px solid var(--theme-elevation-800)' : 'none' }}
              >
                {s.text}
              </mark>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <p role="alert" style={{ margin: 0, padding: '.5rem .75rem', background: 'var(--theme-error-100)', borderRadius: 4 }}>
            {error}
          </p>
        )}

        {selection && (
          // Not a <form>: this sits inside Payload's item form, and a nested form would submit the item.
          <div
            role="group"
            aria-label="New annotation"
            style={{ padding: '1rem', border: '1px solid var(--theme-elevation-250)', borderRadius: 4, display: 'grid', gap: '.6rem' }}
          >
            <strong>New annotation</strong>
            <blockquote style={{ margin: 0, paddingLeft: '.75rem', borderLeft: '3px solid var(--theme-elevation-300)' }}>
              {selection.quote.length > 240 ? `${selection.quote.slice(0, 240)}…` : selection.quote}
            </blockquote>
            <label>
              Category{' '}
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '.25rem' }}>
              Annotation
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} required />
            </label>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--style-primary btn--size-small" disabled={busy || !body.trim()} onClick={() => void create('submitted')}>
                Submit for review
              </button>
              <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy || !body.trim()} onClick={() => void create('draft')}>
                Save as draft
              </button>
              <button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => setSelection(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <h4 style={{ margin: 0 }}>
          Annotations ({notes.length}
          {notes.some((n) => n.status === 'submitted') ? `, ${notes.filter((n) => n.status === 'submitted').length} awaiting review` : ''})
        </h4>
        {notes.length === 0 && <p style={{ margin: 0 }}>None yet.</p>}
        {notes.map((n) => (
          <article
            key={n.id}
            id={`ann-card-${n.id}`}
            style={{
              padding: '.75rem',
              border: `1px solid ${focus === n.id ? 'var(--theme-elevation-800)' : 'var(--theme-elevation-150)'}`,
              borderRadius: 4,
              display: 'grid',
              gap: '.4rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', fontSize: '.8rem' }}>
              <span style={{ ...LOOK[n.status].mark, padding: '0 .4em' }}>{LOOK[n.status].label}</span>
              <span>{CATEGORIES.find(([v]) => v === n.category)?.[1] ?? n.category}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFocus(n.id)
                document.getElementById(`ann-text-${n.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              }}
              style={{ all: 'unset', cursor: 'pointer', fontStyle: 'italic' }}
            >
              “{n.quote.length > 120 ? `${n.quote.slice(0, 120)}…` : n.quote}”
            </button>
            {placed.unplaced.includes(n.id) && (
              <small style={{ color: 'var(--theme-error-500)' }}>
                This passage could not be found in the current transcript (it may have been edited). Edit the annotation to re-anchor it.
              </small>
            )}
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{n.body}</p>
            {n.reviewNote && (
              <p style={{ margin: 0, fontSize: '.85rem' }}>
                <strong>Review note:</strong> {n.reviewNote}
              </p>
            )}
            <small style={{ color: 'var(--theme-elevation-600)' }}>
              By {nameOf(n.author)}
              {idOf(n.lastEditedBy) !== idOf(n.author) && n.lastEditedBy ? ` · last changed by ${nameOf(n.lastEditedBy)}` : ''}
              {n.reviewedBy ? ` · ${n.status === 'approved' ? 'approved' : 'returned'} by ${nameOf(n.reviewedBy)}` : ''}
            </small>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
              {canReview(n) && (
                <>
                  <button type="button" className="btn btn--style-primary btn--size-small" disabled={busy} onClick={() => void act(n, { status: 'approved' })}>
                    Approve
                  </button>
                  <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={() => returnWithNote(n)}>
                    Return
                  </button>
                </>
              )}
              {n.status === 'submitted' && isEditor && !canReview(n) && (
                <small style={{ alignSelf: 'center' }}>Needs review by someone else.</small>
              )}
              {ownsDraft(n) && n.status === 'draft' && (
                <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={() => void act(n, { status: 'submitted' })}>
                  Submit for review
                </button>
              )}
              {isEditor && n.status === 'approved' && (
                <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={() => void act(n, { status: 'submitted' })}>
                  Take down
                </button>
              )}
              {(ownsDraft(n) || isEditor) && (
                <a className="btn btn--style-secondary btn--size-small" href={`${config.routes.admin}/collections/annotations/${n.id}`}>
                  Edit
                </a>
              )}
              {(ownsDraft(n) || isEditor) && (
                <button
                  type="button"
                  className="btn btn--style-secondary btn--size-small"
                  disabled={busy}
                  onClick={() => window.confirm('Delete this annotation?') && void act(n, 'delete')}
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
