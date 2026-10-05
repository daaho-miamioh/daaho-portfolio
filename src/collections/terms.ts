import type { CollectionConfig } from 'payload'

import { anyone, editors } from '@/access/roles'
import { slugField } from '@/fields/slug'

/** Places, subjects and genres share one shape: a controlled heading plus an optional authority link. */
export function termCollection(opts: {
  slug: string
  singular: string
  plural: string
  authorityLabel: string
}): CollectionConfig {
  return {
    slug: opts.slug,
    labels: { singular: opts.singular, plural: opts.plural },
    admin: { useAsTitle: 'name', group: 'Linked entries', defaultColumns: ['name', 'authorityUri'] },
    access: { read: anyone, create: editors, update: editors, delete: editors },
    fields: [
      { name: 'name', type: 'text', required: true, unique: true },
      slugField('name'),
      { name: 'authorityUri', type: 'text', label: opts.authorityLabel },
      { name: 'description', type: 'richText' },
    ],
  }
}
