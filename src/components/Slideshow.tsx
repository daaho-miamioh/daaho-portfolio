'use client'

import { useState } from 'react'

export type Slide = { src: string; srcSet?: string; alt: string; caption?: string | null; width?: number | null; height?: number | null }

/**
 * One slide at a time, moved only by the visitor — no autoplay, so nothing moves on its own
 * (WCAG 2.2.2) and every caption can be read at leisure.
 */
export function Slideshow({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0)
  if (!slides.length) return null
  const s = slides[i]
  const go = (d: number) => setI((n) => (n + d + slides.length) % slides.length)
  return (
    <section className="slideshow" aria-roledescription="carousel" aria-label="Images from the project">
      <figure aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`}>
        <div className="slide-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.src} srcSet={s.srcSet || undefined} sizes="(min-width: 72rem) 70rem, 100vw" alt={s.alt} width={s.width ?? undefined} height={s.height ?? undefined} />
        </div>
        {s.caption && <figcaption>{s.caption}</figcaption>}
      </figure>
      {slides.length > 1 && (
        <div className="slide-controls">
          <button type="button" onClick={() => go(-1)} aria-label="Previous image">
            ←
          </button>
          <span aria-live="polite">
            {i + 1} / {slides.length}
          </span>
          <button type="button" onClick={() => go(1)} aria-label="Next image">
            →
          </button>
        </div>
      )}
    </section>
  )
}
