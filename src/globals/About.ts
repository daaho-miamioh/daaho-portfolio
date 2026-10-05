import type { GlobalConfig } from 'payload'

import { anyone, editors } from '@/access/roles'

export const About: GlobalConfig = {
  slug: 'about',
  label: 'About page',
  admin: { group: 'Site' },
  access: { read: anyone, update: editors },
  fields: [
    { name: 'heading', type: 'text', required: true, defaultValue: 'About the project' },
    { name: 'body', type: 'richText' },
  ],
}
