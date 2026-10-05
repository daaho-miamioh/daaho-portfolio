import type { TextField } from 'payload'

import { slugify } from '@/lib/slug'

/** URL slug derived from another field on first save; editable afterwards, never silently changed. */
export function slugField(from: string): TextField {
  return {
    name: 'slug',
    type: 'text',
    unique: true,
    index: true,
    admin: { position: 'sidebar', description: 'Used in the page address. Changing it breaks existing links.' },
    hooks: {
      beforeValidate: [
        ({ value, data }) => {
          if (typeof value === 'string' && value.trim()) return slugify(value)
          const source = data?.[from]
          return typeof source === 'string' ? slugify(source) : value
        },
      ],
    },
  }
}
