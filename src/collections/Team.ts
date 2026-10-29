import type { CollectionConfig } from 'payload'

import { anyone, editors } from '@/access/roles'
import { makeMediaPublic } from '@/lib/publicMedia'

export const TEAM_GROUPS = [
  { label: 'Project team', value: 'project-team' },
  { label: 'Partners', value: 'partners' },
  { label: 'Archives and Content Committee', value: 'committee' },
  { label: 'Former project team', value: 'former-team' },
  { label: 'Previous student assistants', value: 'former-students' },
] as const

/** The project team, for the About page. Historical people named in items live in People. */
export const Team: CollectionConfig = {
  slug: 'team',
  labels: { singular: 'Team member', plural: 'Team' },
  admin: {
    useAsTitle: 'name',
    group: 'Site',
    defaultColumns: ['name', 'group', 'title', 'order'],
    description: 'Shown on the About page in these groups, in order within each group (lower numbers first).',
  },
  defaultSort: 'order',
  access: { read: anyone, create: editors, update: editors, delete: editors },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        await makeMediaPublic(req, [doc.photo])
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'group', type: 'select', required: true, defaultValue: 'partners', options: [...TEAM_GROUPS], index: true },
    { name: 'title', type: 'text', admin: { description: 'Role or position, e.g. Co-Principal Investigator' } },
    { name: 'affiliation', type: 'text' },
    { name: 'bio', type: 'textarea', admin: { rows: 5 } },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'order', type: 'number', defaultValue: 100, admin: { position: 'sidebar', description: 'Lower first, within the group.' } },
  ],
}
