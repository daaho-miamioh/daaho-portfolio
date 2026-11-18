'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Role = 'admin' | 'editor' | 'contributor'

/**
 * Correct a transcript on the item page, for signed-in staff, without opening the admin.
 *
 * Saves go through the same API and rules as the admin: an editor's correction to a published item
 * is published; a contributor's is kept as a draft for an editor to publish. Every save is recorded in
 * the activity log with who made it, and the item's versions keep each earlier text, so a change can
 * be compared or restored from History.
 */
export function TranscriptEditor({
  itemId,
  transcript,
  status,
  role,
  updatedAt,
  checked,
}: {
  itemId: number
  transcript: string
  status: 'published' | 'draft'
  role: Role
  updatedAt: string
  checked: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(transcript)
  const [markChecked, setMarkChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'problem'; text: string } | null>(null)
  const asDraft = status !== 'published' || role === 'contributor'

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      // Refuse to overwrite a save someone else made after this page was opened.
      const current = await fetch(`/api/items/${itemId}?draft=true&depth=0`, { credentials: 'include' }).then((r) => r.json())
      if (current?.updatedAt && current.updatedAt !== updatedAt) {
        setMessage({ kind: 'problem', text: 'Someone saved this item after you opened the page. Copy your changes, reload, and edit again.' })
        return
      }
      const res = await fetch(`/api/items/${itemId}?draft=${asDraft}&depth=0`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          ...(markChecked ? { review: { ...(current?.review ?? {}), transcriptChecked: true } } : {}),
          _status: asDraft ? 'draft' : 'published',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ kind: 'problem', text: json?.errors?.[0]?.message || 'The transcript could not be saved.' })
        return
      }
      setEditing(false)
      setMessage({
        kind: 'ok',
        text: asDraft && status === 'published' ? 'Saved as a draft. An editor will publish your correction.' : 'Saved. The change is in the activity log.',
      })
      router.refresh()
    } catch {
      setMessage({ kind: 'problem', text: 'The transcript could not be saved. Check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="transcript-editor">
      {!editing && (
        <p className="transcript-editor-bar">
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setText(transcript)
              setEditing(true)
              setMessage(null)
            }}
          >
            Correct the transcript
          </button>{' '}
          <a href={`/admin/collections/items/${itemId}/versions`}>History</a>
        </p>
      )}
      {editing && (
        <div className="transcript-editor-panel">
          <p className="join-hint">
            Follow the Transcription Policy: keep the original spelling and add corrections in [brackets], mark unreadable words
            [illegible], and keep the [page N] markers. Your name is recorded with the change.
            {asDraft && status === 'published' ? ' Your correction is saved as a draft for an editor to publish.' : ''}
          </p>
          <label htmlFor="transcript-editor-text" className="visually-hidden">
            Transcript
          </label>
          <textarea id="transcript-editor-text" value={text} onChange={(e) => setText(e.target.value)} rows={18} spellCheck={false} />
          {!checked && (
            <label className="transcript-editor-check">
              <input type="checkbox" checked={markChecked} onChange={(e) => setMarkChecked(e.target.checked)} /> I checked the whole
              transcript against the original
            </label>
          )}
          <div className="suggest-actions">
            <button type="button" className="button" disabled={busy || text === transcript} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save correction'}
            </button>
            <button type="button" className="button-secondary" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role={message.kind === 'problem' ? 'alert' : 'status'} className={message.kind === 'problem' ? 'join-problem' : 'notice notice-staff'}>
          {message.text}
        </p>
      )}
    </div>
  )
}
