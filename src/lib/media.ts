import type { Media } from '@/payload-types'

type Size = 'thumbnail' | 'card' | 'reading'

export function asMedia(value: unknown): Media | null {
  return value && typeof value === 'object' && 'url' in value ? (value as Media) : null
}

export function src(media: Media, size: Size): string {
  return media.sizes?.[size]?.url || media.url || ''
}

export function srcSet(media: Media, sizes: Size[] = ['thumbnail', 'card', 'reading']): string {
  return sizes
    .map((s) => media.sizes?.[s])
    .filter((s): s is NonNullable<typeof s> => !!s?.url && !!s.width)
    .map((s) => `${s.url} ${s.width}w`)
    .join(', ')
}
