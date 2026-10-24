import type { CollectionConfig } from 'payload'

import { editors, loggedIn, publishedOrLoggedIn } from '@/access/roles'
import { slugField } from '@/fields/slug'
import {
  deleteAnnotations,
  deriveDateSort,
  derivePublic,
  hideUnchecked,
  publishGate,
  stampChecks,
  stampTranslation,
  syncVisibility,
  syncVisibilityOnDelete,
} from '@/hooks/items'
import { publicOnceChecked, publicOnceTranslated, staffOnly } from '@/lib/publicView'
import { REGIONS } from '@/lib/regions'

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
    listSearchableFields: ['itemId', 'title', 'transcript', 'translation.text'],
    description: 'Archival items. Imported from the metadata pipeline as drafts; published after review.',
  },
  // Not dateSort: the public may not sort by a date nobody has checked. Pages choose their own order.
  defaultSort: 'itemId',
  versions: { drafts: true, maxPerDoc: 25 },
  access: { read: publishedOrLoggedIn, create: loggedIn, update: loggedIn, delete: editors },
  hooks: {
    beforeChange: [publishGate, stampChecks, stampTranslation, deriveDateSort, derivePublic],
    afterChange: [syncVisibility],
    afterDelete: [syncVisibilityOnDelete],
    afterRead: [hideUnchecked],
    beforeDelete: [deleteAnnotations],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Description',
          fields: [
            { name: 'title', type: 'text', required: true, access: { read: publicOnceChecked('titleChecked') } },
            {
              name: 'date',
              type: 'text',
              access: { read: publicOnceChecked('titleChecked') },
              admin: { description: 'YYYY-MM-DD, YYYY-MM or YYYY. Leave empty if undated.' },
            },
            { name: 'description', type: 'textarea', access: { read: publicOnceChecked('descriptionChecked') } },
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
              access: { read: publicOnceChecked('transcriptChecked') },
              admin: {
                rows: 30,
                description:
                  'Follows the DAAHO Transcription Policy: [page N] markers, original spelling with [corrections], [illegible], [struck: ...].',
              },
            },
          ],
        },
        {
          label: 'Translation',
          description:
            'An English translation of a non-English original. The transcript stays the authoritative text; the translation is shown beside it on the public page, labelled with its status.',
          fields: [
            {
              name: 'translation',
              type: 'group',
              access: { read: publicOnceTranslated },
              label: false,
              fields: [
                {
                  name: 'text',
                  type: 'textarea',
                  label: 'English translation',
                  admin: {
                    rows: 30,
                    description: 'Keep the [page N] markers so readers can match pages with the original.',
                  },
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'status',
                      type: 'select',
                      defaultValue: 'ai',
                      options: [
                        { label: 'AI-generated — not yet verified', value: 'ai' },
                        { label: 'Verified by project staff', value: 'verified' },
                        { label: 'Translated by project staff', value: 'human' },
                      ],
                      admin: { width: '50%', description: 'Choose Verified only after checking it against the original.' },
                    },
                    {
                      name: 'model',
                      type: 'text',
                      label: 'AI model',
                      admin: { width: '50%', condition: (_, s) => s?.status !== 'human', description: 'e.g. Claude Opus 5.5' },
                    },
                    {
                      name: 'translator',
                      type: 'text',
                      label: 'Translated by',
                      admin: { width: '50%', condition: (_, s) => s?.status === 'human', description: 'Name shown on the public page.' },
                    },
                  ],
                },
                {
                  name: 'note',
                  type: 'textarea',
                  label: 'Note for readers',
                  admin: { description: 'Shown with the translation, e.g. how names or terms were rendered. Optional.' },
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'verifiedBy', type: 'relationship', relationTo: 'users', admin: { width: '50%', description: 'Your name when you mark it verified; choose someone else if they verified it.' } },
                    { name: 'verifiedAt', type: 'date', admin: { readOnly: true, width: '50%' } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Annotations',
          description: 'Notes on passages of the transcript. Each is public only after someone other than its author approves it.',
          fields: [
            {
              name: 'annotator',
              type: 'ui',
              admin: { components: { Field: '/components/admin/TranscriptAnnotator#TranscriptAnnotator' } },
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
          label: 'Context',
          description: 'Historical contexts shown beside this item. They are context for the period, not a claim that the item mentions them.',
          fields: [
            {
              name: 'regions',
              type: 'select',
              hasMany: true,
              options: REGIONS.map((r) => ({ label: r, value: r })),
              admin: { description: 'Asian countries this item concerns. Set from its title, description and places on import; correct it here.' },
            },
            {
              name: 'contextEvents',
              type: 'relationship',
              relationTo: 'events',
              hasMany: true,
              label: 'Pinned historical contexts',
              admin: { description: 'Always shown, first. Only published ones appear publicly.' },
            },
            {
              name: 'hideAutoContext',
              type: 'checkbox',
              label: 'Show only pinned historical contexts',
              admin: { description: 'Turn off historical contexts matched automatically by year and region.' },
            },
          ],
        },
        {
          label: 'Archival',
          description: 'The library catalog record, written by people and always public. The pipeline cannot know these.',
          fields: [
            {
              name: 'archival',
              type: 'group',
              fields: [
                { name: 'creator', type: 'text', admin: { description: 'As in the catalog record, e.g. Shriver, Phillip R.' } },
                { name: 'digitalCollection', type: 'text', admin: { description: 'e.g. Asian American Experience at Miami University' } },
                {
                  type: 'row',
                  fields: [
                    { name: 'type', type: 'text', admin: { description: 'e.g. Text, Still image' } },
                    { name: 'theme', type: 'text' },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'extent', type: 'text', admin: { description: 'e.g. 2 pages' } },
                    { name: 'dimensions', type: 'text', admin: { description: 'e.g. 28 x 21.5 cm' } },
                  ],
                },
                { name: 'repository', type: 'text' },
                { name: 'collection', type: 'text' },
                { name: 'series', type: 'text' },
                { type: 'row', fields: [{ name: 'box', type: 'text' }, { name: 'folder', type: 'text' }] },
                { type: 'row', fields: [{ name: 'shelf', type: 'text' }, { name: 'callNumber', type: 'text' }] },
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
    { name: 'dateSort', type: 'date', index: true, access: { read: publicOnceChecked('titleChecked') }, admin: { position: 'sidebar', readOnly: true } },
    { name: 'language', type: 'text', admin: { position: 'sidebar' } },
    {
      name: 'review',
      type: 'group',
      label: 'Checked by staff',
      admin: {
        position: 'sidebar',
        description: 'Only checked parts are shown to the public. Everything stays visible to signed-in staff.',
      },
      fields: [
        { name: 'titleChecked', type: 'checkbox', label: 'Title and date checked' },
        { name: 'descriptionChecked', type: 'checkbox', label: 'Description checked' },
        { name: 'transcriptChecked', type: 'checkbox', label: 'Transcript checked' },
        { name: 'linksChecked', type: 'checkbox', label: 'People, places and subjects checked' },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'ai_generated',
          admin: { readOnly: true, description: 'Follows the checks above.' },
          options: [
            { label: 'AI-generated, not reviewed', value: 'ai_generated' },
            { label: 'In review', value: 'in_review' },
            { label: 'Reviewed', value: 'reviewed' },
          ],
        },
        {
          name: 'reviewedBy',
          type: 'relationship',
          relationTo: 'users',
          label: 'Last checked by',
          admin: { description: 'Fills in with your name when you tick a check. Choose someone else if they did the checking.' },
        },
        { name: 'reviewedAt', type: 'date', label: 'Last checked', admin: { readOnly: true } },
        { name: 'notes', type: 'textarea', access: { read: staffOnly }, admin: { description: 'Staff only.' } },
      ],
    },
    {
      name: 'ai',
      type: 'group',
      label: 'AI provenance',
      access: { read: staffOnly },
      admin: { position: 'sidebar', readOnly: true },
      fields: [
        { name: 'model', type: 'text' },
        { name: 'promptVersion', type: 'text' },
        { name: 'transcriptConfidence', type: 'number' },
        { name: 'lowConfidence', type: 'checkbox', admin: { description: 'Transcript confidence below 70.' } },
        { name: 'fieldConfidence', type: 'json' },
        // Kept when a person's version replaces the AI's, so staff can see what changed.
        { name: 'originalTitle', type: 'text', label: 'AI title (replaced)' },
        { name: 'originalDate', type: 'text', label: 'AI date (replaced)' },
        { name: 'originalDescription', type: 'textarea', label: 'AI description (replaced)' },
      ],
    },
    // Derived from checked parts only (hooks/items.ts derivePublic): what the public search matches
    // and the order and decades the public sees.
    { name: 'publicText', type: 'textarea', admin: { hidden: true } },
    { name: 'publicDateSort', type: 'date', index: true, admin: { hidden: true } },
    {
      name: 'importIssues',
      type: 'array',
      access: { read: staffOnly },
      admin: {
        position: 'sidebar',
        description: 'Problems the importer found and would not guess at. Resolve, then delete the row.',
      },
      fields: [{ name: 'issue', type: 'text' }],
    },
  ],
}
