import { addDataAndFileToRequest, type Access, type CollectionConfig, type Where } from 'payload'

import { hasRole, loggedIn } from '@/access/roles'
import { anchorToTranscript, reviewRule } from '@/hooks/annotations'
import { ANNOTATION_CATEGORIES } from '@/lib/annotationCategories'
import { jsonEndpoint } from '@/lib/endpoint'
import { suggestAnnotation } from '@/lib/suggestions'

export { ANNOTATION_CATEGORIES }

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

const staffOnly = ({ req }: { req: { user?: unknown } }) => !!req.user

/**
 * Notes attached to a passage of a transcript. Written by staff in the item editor, or suggested by
 * visitors on the item page; public only after someone other than the author approves them.
 */
export const Annotations: CollectionConfig = {
  slug: 'annotations',
  labels: { singular: 'Annotation', plural: 'Annotations' },
  admin: {
    useAsTitle: 'quote',
    group: 'Content',
    defaultColumns: ['quote', 'item', 'source', 'category', 'status', 'author'],
    description:
      'Notes on passages of transcripts, from two sources, shown under Source: "Project staff" notes are written in the item editor (Annotations tab); "Public suggestion" notes are sent by visitors from the item page. Either kind is public only after someone other than its writer approves it.',
  },
  versions: { maxPerDoc: 25 },
  access: { read: publicRead, create: loggedIn, update: authorOrEditor, delete: authorOrEditor },
  hooks: { beforeChange: [reviewRule, anchorToTranscript] },
  endpoints: [
    {
      // Visitors suggest a note on a passage of a public transcript; it waits for an editor.
      path: '/suggest',
      method: 'post',
      handler: jsonEndpoint(async (req) => {
        await addDataAndFileToRequest(req)
        return suggestAnnotation(req, (req.data ?? {}) as Record<string, unknown>)
      }),
    },
  ],
  fields: [
    { name: 'item', type: 'relationship', relationTo: 'items', required: true, index: true },
    { name: 'quote', type: 'textarea', required: true, label: 'Annotated passage' },
    { name: 'category', type: 'select', required: true, defaultValue: 'context', options: [...ANNOTATION_CATEGORIES] },
    { name: 'body', type: 'textarea', required: true, label: 'Annotation' },
    // First in the sidebar, so who wrote a note is the first thing a reviewer sees.
    {
      name: 'source',
      type: 'select',
      defaultValue: 'staff',
      options: [
        { label: 'Project staff', value: 'staff' },
        { label: 'Public suggestion', value: 'public' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Set by the system: Project staff wrote it in the item editor, or a visitor suggested it on the website.',
      },
    },
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
    { name: 'submitterName', type: 'text', label: "Visitor's name", access: { read: staffOnly }, admin: { position: 'sidebar', readOnly: true, condition: (d) => d?.source === 'public' } },
    { name: 'submitterEmail', type: 'email', label: "Visitor's email", access: { read: staffOnly }, admin: { position: 'sidebar', readOnly: true, condition: (d) => d?.source === 'public' } },
    // A salted hash of the visitor's address, to limit how often one source sends. Never shown.
    { name: 'submitterHash', type: 'text', index: true, access: { read: () => false }, admin: { hidden: true } },
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
