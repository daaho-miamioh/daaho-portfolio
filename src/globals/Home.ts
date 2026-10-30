import type { GlobalConfig } from 'payload'

import { anyone, editors } from '@/access/roles'
import { makeMediaPublic } from '@/lib/publicMedia'

const url = (v: unknown) => !v || /^https?:\/\/\S+$/.test(String(v)) || 'Use a full web address starting with https://'

export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Home page',
  admin: { group: 'Site' },
  access: { read: anyone, update: editors },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        await makeMediaPublic(req, [...(doc.slides ?? []).map((s: { image: unknown }) => s.image), ...(doc.sponsors ?? []).map((s: { logo: unknown }) => s.logo)])
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Introduction',
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
            {
              name: 'submitLink',
              type: 'group',
              label: 'Submit a collection',
              admin: { description: 'A button in the site header. Leave the address empty to hide it.' },
              fields: [
                { name: 'label', type: 'text', defaultValue: 'Submit a collection' },
                { name: 'url', type: 'text', validate: url },
              ],
            },
          ],
        },
        {
          label: 'Slideshow',
          fields: [
            {
              name: 'slides',
              type: 'array',
              labels: { singular: 'Slide', plural: 'Slides' },
              admin: { description: 'Images at the top of the home page. Alternative text is set on each image; the caption is shown under it.' },
              fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                { name: 'caption', type: 'textarea' },
              ],
            },
          ],
        },
        {
          label: 'Mission and goals',
          description: 'Shown on the About page.',
          fields: [
            { name: 'mission', type: 'textarea', admin: { rows: 6 } },
            { name: 'goalsIntro', type: 'textarea', label: 'Goals introduction' },
            {
              name: 'goals',
              type: 'array',
              labels: { singular: 'Goal', plural: 'Goals' },
              fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'text', type: 'textarea', required: true },
              ],
            },
          ],
        },
        {
          label: 'Events and sponsors',
          fields: [
            { name: 'eventsIntro', type: 'textarea', label: 'Events introduction', admin: { description: 'Shown above the events on the home page and the Events page.' } },
            {
              name: 'sponsors',
              type: 'array',
              labels: { singular: 'Sponsor', plural: 'Sponsors' },
              admin: { description: 'Shown at the foot of the home page and the About page.' },
              fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'logo', type: 'upload', relationTo: 'media' },
                { name: 'url', type: 'text', validate: url },
              ],
            },
          ],
        },
      ],
    },
  ],
}
