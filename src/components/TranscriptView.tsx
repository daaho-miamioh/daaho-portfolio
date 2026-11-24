'use client'

import { useState } from 'react'

const VIEWS = [
  ['pages', 'Page by page'],
  ['text', 'Full text'],
] as const

/**
 * Switches a paged transcript (AnnotatedTranscript with pageFigures) between each scan beside its
 * page and the whole text in one block. One set of text serves both, so a note or a selection
 * means the same passage in either view. Without JavaScript the page-by-page view stays.
 */
export function TranscriptView({ targetId, pageCount }: { targetId: string; pageCount: number }) {
  const [view, setView] = useState<'pages' | 'text'>('pages')
  const choose = (v: 'pages' | 'text') => {
    setView(v)
    const el = document.getElementById(targetId)
    if (el) el.dataset.view = v
  }
  return (
    <div className="view-switch" role="group" aria-label="How to show the transcript">
      {VIEWS.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={view === v} aria-controls={targetId} onClick={() => choose(v)}>
          {label}
          {v === 'pages' && <span className="visually-hidden">: each of the {pageCount} scans beside its transcript</span>}
        </button>
      ))}
    </div>
  )
}
