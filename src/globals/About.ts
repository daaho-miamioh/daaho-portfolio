import type { GlobalConfig } from 'payload'

import { anyone, editors } from '@/access/roles'
import { makeMediaPublic } from '@/lib/publicMedia'

export const About: GlobalConfig = {
  slug: 'about',
  label: 'About page',
  admin: { group: 'Site', description: 'Team members are edited under Site → Team.' },
  access: { read: anyone, update: editors },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        await makeMediaPublic(req, [doc.logo?.image])
        return doc
      },
    ],
  },
  fields: [
    { name: 'heading', type: 'text', required: true, defaultValue: 'About the project' },
    { name: 'body', type: 'richText' },
    {
      name: 'logo',
      type: 'group',
      label: 'About our logo',
      fields: [
        { name: 'heading', type: 'text', defaultValue: 'About our logo' },
        { name: 'image', type: 'upload', relationTo: 'media' },
        { name: 'text', type: 'textarea', admin: { rows: 8, description: 'Leave a blank line between paragraphs.' } },
      ],
    },
  ],
}
