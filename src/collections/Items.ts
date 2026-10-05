import type { CollectionConfig } from 'payload'

import { editors, loggedIn, publishedOrLoggedIn } from '@/access/roles'
import { slugField } from '@/fields/slug'
import { deriveDateSort, publishGate, stampReview, syncVisibility } from '@/hooks/items'

export const PERSON_ROLES = [
  { label: 'Creator', value: 'creator' },
  { label: 'Correspondent', value: 'correspondent' },
  { label: 'Named in document', value: 'contributor' },
] as const

export const Items: CollectionConfig = {
  slug: 'items',
  labels: { singular: 'Item', plural: 'Items' },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['itemId', 'title', 'date', 'review.status', '_status'],
    listSearchableFields: ['itemId', 'title', 'transcript'],
    description: 'Archival items. Imported from the metadata pipeline as drafts; published after review.',
  },
  defaultSort: 'dateSort',
  versions: { drafts: true, maxPerDoc: 25 },
  access: { read: publishedOrLoggedIn, create: loggedIn, update: loggedIn, delete: editors },
  hooks: {
    beforeChange: [publishGate, stampReview, deriveDateSort],
    afterChange: [syncVisibility],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Description',
          fields: [
            { name: 'title', type: 'text', required: true },
            {
              name: 'date',
              type: 'text',
              admin: { description: 'YYYY-MM-DD, YYYY-MM or YYYY. Leave empty if undated.' },
            },
            { name: 'description', type: 'textarea' },
            { name: 'rights', type: 'textarea', admin: { description: 'Required before publishing.' } },
          ],
        },
        {
          label: 'Pages',
          fields: [
            {
              name: 'pages',
              type: 'array',
              labels: { singular: 'Page', plural: 'Pages' },
              fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                { name: 'label', type: 'text', admin: { description: 'e.g. Recto, Verso, Page 2' } },
              ],
            },
          ],
        },
        {
          label: 'Transcript',
          fields: [
            {
              name: 'transcript',
              type: 'textarea',
              admin: {
                rows: 30,
                description:
                  'Follows the DAAHO Transcription Policy: [page N] markers, original spelling with [corrections], [illegible], [struck: ...].',
              },
            },
          ],
        },
        {
          label: 'Links',
          fields: [
            {
              name: 'people',
              type: 'array',
              labels: { singular: 'Person', plural: 'People' },
              fields: [
                { name: 'person', type: 'relationship', relationTo: 'people', required: true },
                { name: 'role', type: 'select', required: true, options: [...PERSON_ROLES] },
              ],
            },
            { name: 'places', type: 'relationship', relationTo: 'places', hasMany: true },
            { name: 'subjects', type: 'relationship', relationTo: 'subjects', hasMany: true },
            { name: 'genres', type: 'relationship', relationTo: 'genres', hasMany: true },
          ],
        },
        {
          label: 'Archival',
          description: 'Filled by archivists. The pipeline cannot know these.',
          fields: [
            {
              name: 'archival',
              type: 'group',
              fields: [
                { name: 'repository', type: 'text' },
                { name: 'collection', type: 'text' },
                { name: 'series', type: 'text' },
                { type: 'row', fields: [{ name: 'box', type: 'text' }, { name: 'folder', type: 'text' }] },
                { name: 'callNumber', type: 'text' },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'itemId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Item ID',
      admin: { position: 'sidebar', description: 'Pipeline identifier, e.g. AAMU-0001.' },
    },
    slugField('itemId'),
    { name: 'dateSort', type: 'date', index: true, admin: { position: 'sidebar', readOnly: true } },
    { name: 'language', type: 'text', admin: { position: 'sidebar' } },
    {
      name: 'review',
      type: 'group',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'ai_generated',
          options: [
            { label: 'AI-generated, not reviewed', value: 'ai_generated' },
            { label: 'In review', value: 'in_review' },
            { label: 'Reviewed', value: 'reviewed' },
          ],
        },
        { name: 'reviewedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        { name: 'reviewedAt', type: 'date', admin: { readOnly: true } },
        { name: 'notes', type: 'textarea' },
      ],
    },
    {
      name: 'ai',
      type: 'group',
      label: 'AI provenance',
      admin: { position: 'sidebar', readOnly: true },
      fields: [
        { name: 'model', type: 'text' },
        { name: 'promptVersion', type: 'text' },
        { name: 'transcriptConfidence', type: 'number' },
        { name: 'lowConfidence', type: 'checkbox', admin: { description: 'Transcript confidence below 70.' } },
        { name: 'fieldConfidence', type: 'json' },
      ],
    },
    {
      name: 'importIssues',
      type: 'array',
      admin: {
        position: 'sidebar',
        description: 'Problems the importer found and would not guess at. Resolve, then delete the row.',
      },
      fields: [{ name: 'issue', type: 'text' }],
    },
  ],
}
