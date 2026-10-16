/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react'

// The logo has black outlines and lettering on a transparent ground, so in the admin's dark theme it
// sits on a white tile rather than being recoloured.
const tile: CSSProperties = { display: 'inline-grid', placeItems: 'center', background: '#fff', borderRadius: 12 }

/** DAAHO's logo on the admin sign-in screen, in place of Payload's. */
export function Logo() {
  return (
    <span style={{ ...tile, padding: '12px 18px' }}>
      <img src="/brand/daaho-logo.png" alt="DAAHO" width={140} height={140} style={{ width: 140, height: 'auto' }} />
    </span>
  )
}

/** The logo mark in the admin's top bar. Fills the slot Payload gives it (sized in custom.scss). */
export function Icon() {
  return (
    <span style={{ ...tile, width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden' }}>
      <img src="/brand/daaho-mark.svg" alt="DAAHO" style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
    </span>
  )
}
