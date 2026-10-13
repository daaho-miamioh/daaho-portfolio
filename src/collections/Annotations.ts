import type { Access, CollectionConfig, Where } from 'payload'

import { hasRole, loggedIn } from '@/access/roles'
import { anchorToTranscript, reviewRule } from '@/hooks/annotations'

export const ANNOTATION_CATEGORIES = [
  { label: 'Context', value: 'context' },
  { label: 'Person', value: 'person' },
  { label: 'Place', value: 'place' },
  { label: 'Translation', value: 'translation' },
  { label: 'Correction', value: 'correction' },
  { label: 'Harmful language', value: 'harmful-language' },
  { label: 'Other', value: 'other' },
] as const

const publicRead: Access = ({ req }) => {
  if (req.user) return true
  const approved: Where = { status: { equals: 'approved' } }
  return approved
}

/** Authors may change or withdraw their own annotation until it is approved; editors and admins, any. */
const authorOrEditor: Access = ({ req }) => {
  if (!req.user) return false
  if (hasRole(req, 'admin', 'editor')) return true
  const own: Where = { and: [{ author: { equals: req.user.id } }, { status: { not_equals: 'approved' } }] }
  return own
}

/**
 * Notes attached to a passage of a transcript. Written by staff in the item editor, public only after
 * someone other than the author approves them.
 */
export const Annotations: CollectionConfig = {
  slug: 'annotations',
  labels: { singular: 'Annotation', plural: 'Annotations' },
  admin: {
    useAsTitle: 'quote',
    group: 'Content',
    defaultColumns: ['quote', 'item', 'category', 'status', 'author'],
    description: 'Written from the item editor (Annotations tab). Public only after approval by someone other than the author.',
  },
  versions: { maxPerDoc: 25 },
  access: { read: publicRead, create: loggedIn, update: authorOrEditor, delete: authorOrEditor },
  hooks: { beforeChange: [reviewRule, anchorToTranscript] },
  fields: [
    { name: 'item', type: 'relationship', relationTo: 'items', required: true, index: true },
    { name: 'quote', type: 'textarea', required: true, label: 'Annotated passage' },
    { name: 'category', type: 'select', required: true, defaultValue: 'context', options: [...ANNOTATION_CATEGORIES] },
    { name: 'body', type: 'textarea', required: true, label: 'Annotation' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      index: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Submitted for review', value: 'submitted' },
        { label: 'Approved — public', value: 'approved' },
        { label: 'Returned', value: 'rejected' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'reviewNote', type: 'textarea', admin: { position: 'sidebar', description: 'Why it was returned, or anything the author should know.' } },
    { name: 'author', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar', readOnly: true } },
    { name: 'lastEditedBy', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar', readOnly: true } },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar', readOnly: true } },
    { name: 'reviewedAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'start', type: 'number', admin: { readOnly: true, description: 'Offset when last anchored' } },
        { name: 'end', type: 'number', admin: { readOnly: true } },
      ],
    },
    { name: 'prefix', type: 'text', admin: { readOnly: true, description: 'Text just before the passage, used to find it again' } },
    { name: 'suffix', type: 'text', admin: { readOnly: true, description: 'Text just after the passage' } },
  ],
}
