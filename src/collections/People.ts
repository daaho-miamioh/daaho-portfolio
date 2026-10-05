import type { CollectionConfig, Where } from 'payload'

import { editors, loggedIn } from '@/access/roles'
import { slugField } from '@/fields/slug'
import { publishGate } from '@/hooks/people'

/**
 * Historical people, organizations and groups named in the items — not the project team (see Team).
 * The importer merges only names that are provably the same; anything that merely might be is
 * listed under "Possible duplicates" for an editor to decide.
 *
 * Names come from documents whose rights may not be cleared, some naming private individuals in
 * personal letters. So a person is visible to the public only once they appear in a published item;
 * `public` is maintained automatically by the Items hooks.
 */
export const People: CollectionConfig = {
  slug: 'people',
  labels: { singular: 'Person or organization', plural: 'People & organizations' },
  admin: {
    useAsTitle: 'name',
    group: 'Linked entries',
    defaultColumns: ['name', 'kind', 'needsReview'],
    listSearchableFields: ['name', 'aliases.value'],
  },
  versions: { drafts: true, maxPerDoc: 25 },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      const visible: Where = { and: [{ public: { equals: true } }, { _status: { equals: 'published' } }] }
      return visible
    },
    create: loggedIn,
    update: loggedIn,
    delete: editors,
  },
  hooks: { beforeChange: [publishGate] },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Inverted form for people: "Upham, Alfred H."' },
    },
    slugField('name'),
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'person',
      options: [
        { label: 'Person', value: 'person' },
        { label: 'Organization', value: 'organization' },
        { label: 'Group', value: 'group' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'dates', type: 'text', admin: { description: 'e.g. 1877–1949' } },
    { name: 'bio', type: 'richText' },
    {
      name: 'aliases',
      type: 'array',
      admin: { description: 'Every spelling found in the source documents.' },
      fields: [{ name: 'value', type: 'text', required: true }],
    },
    {
      name: 'possibleDuplicates',
      type: 'relationship',
      relationTo: 'people',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description: 'Proposed by the importer: same surname, compatible initials. Confirm or clear.',
      },
    },
    {
      name: 'public',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Set automatically: visible to the public once named in a published item.',
      },
    },
    {
      name: 'importKey',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Normalized name the importer matched on.' },
    },
    {
      name: 'needsReview',
      type: 'checkbox',
      admin: { position: 'sidebar', description: 'The source reading of this name was uncertain.' },
    },
  ],
}
