import type { CollectionConfig } from 'payload'

import { anyone, editors } from '@/access/roles'

/** The project team, for the About page. Historical people named in items live in People. */
export const Team: CollectionConfig = {
  slug: 'team',
  labels: { singular: 'Team member', plural: 'Team' },
  admin: { useAsTitle: 'name', group: 'Site', defaultColumns: ['name', 'title', 'order'] },
  defaultSort: 'order',
  access: { read: anyone, create: editors, update: editors, delete: editors },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        const photo = typeof doc.photo === 'object' ? doc.photo?.id : doc.photo
        if (photo) {
          await req.payload.update({ collection: 'media', id: photo, data: { public: true }, req, overrideAccess: true })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'title', type: 'text', admin: { description: 'Role on the project, e.g. Principal Investigator' } },
    { name: 'affiliation', type: 'text' },
    { name: 'bio', type: 'richText' },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'order', type: 'number', defaultValue: 100, admin: { position: 'sidebar', description: 'Lower first.' } },
  ],
}
