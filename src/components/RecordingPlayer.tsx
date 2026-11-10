'use client'

import { useEffect, useRef } from 'react'

/**
 * The listening copy of a recording. Times in its transcript (links carrying data-seek, in seconds)
 * play from that point; so does an address ending #t=83, which is what those links point to, so a
 * moment in an interview can be shared by its link.
 */
export function RecordingPlayer({ src, type, label }: { src: string; type?: string | null; label: string }) {
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const playFrom = (seconds: number) => {
      const el = audio.current
      if (!el || !Number.isFinite(seconds)) return
      el.currentTime = seconds
      void el.play().catch(() => undefined) // a browser may refuse to play before the visitor has clicked
    }
    const fromHash = () => {
      const m = /^#t=(\d+)$/.exec(window.location.hash)
      if (m) playFrom(Number(m[1]))
    }
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-seek]')
      if (!link) return
      e.preventDefault()
      history.replaceState(null, '', `#t=${link.dataset.seek}`)
      playFrom(Number(link.dataset.seek))
      audio.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    document.addEventListener('click', onClick)
    window.addEventListener('hashchange', fromHash)
    fromHash()
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('hashchange', fromHash)
    }
  }, [])

  return (
    <audio ref={audio} className="recording-player" controls preload="metadata" aria-label={label}>
      <source src={src} type={type ?? undefined} />
      Your browser cannot play this recording. <a href={src}>Download it</a> instead.
    </audio>
  )
}
