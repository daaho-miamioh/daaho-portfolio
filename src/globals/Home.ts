import type { GlobalConfig } from 'payload'

import { anyone, editors } from '@/access/roles'

export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Home page',
  admin: { group: 'Site' },
  access: { read: anyone, update: editors },
  fields: [
    { name: 'heading', type: 'text', required: true, defaultValue: 'Documenting Asian American Histories in Ohio' },
    { name: 'intro', type: 'richText' },
    {
      name: 'featured',
      type: 'relationship',
      relationTo: 'items',
      hasMany: true,
      maxRows: 6,
      admin: { description: 'Up to six items for the home page. Only published items are shown publicly.' },
    },
  ],
}
