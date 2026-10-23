import type { CollectionConfig } from 'payload'

import { editors, publishedOrLoggedIn } from '@/access/roles'
import { slugField } from '@/fields/slug'
import { makeMediaPublic } from '@/lib/publicMedia'

/**
 * Stories: a person's life, or a theme, told in prose and set beside the documents in the collection
 * that bear on it, in date order. This follows Carver Spangle's plan for the 2025 exhibit cases: one
 * narrative, the items in it shown left to right in chronological order.
 *
 * Unlike item descriptions, stories are written by people. They are public once published.
 */
export const Stories: CollectionConfig = {
  slug: 'stories',
  labels: { singular: 'Story', plural: 'Stories' },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'storyType', 'decades', '_status'],
    description: 'Biographies and themes written by the project, each with the documents from the collection it draws on.',
  },
  defaultSort: 'title',
  versions: { drafts: true, maxPerDoc: 25 },
  access: { read: publishedOrLoggedIn, create: editors, update: editors, delete: editors },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        if (doc._status === 'published') await makeMediaPublic(req, [doc.subject?.portrait])
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Story',
          fields: [
            { name: 'title', type: 'text', required: true },
            {
              name: 'dek',
              type: 'textarea',
              label: 'Summary',
              admin: { description: 'Two or three sentences for the story list and the top of the page.' },
            },
            { name: 'body', type: 'richText', required: true },
            {
              name: 'credit',
              type: 'text',
              admin: { description: 'e.g. Written by Grace Farrell (B.A., History & International Studies, 2028)' },
            },
            { name: 'authors', type: 'text', hasMany: true, admin: { description: 'Author names, for the citation: First Last.' } },
          ],
        },
        {
          label: 'Person',
          description: 'For a biography: who the story is about.',
          fields: [
            {
              name: 'subject',
              type: 'group',
              label: false,
              fields: [
                { name: 'name', type: 'text' },
                { name: 'lifeDates', type: 'text', admin: { description: 'e.g. 1889–1951' } },
                { name: 'atMiami', type: 'text', label: 'At Miami', admin: { description: 'e.g. B.A., Liberal Arts, 1943' } },
                { name: 'portrait', type: 'upload', relationTo: 'media' },
                { name: 'portraitCaption', type: 'text' },
              ],
            },
          ],
        },
        {
          label: 'Documents',
          fields: [
            {
              name: 'documents',
              type: 'relationship',
              relationTo: 'items',
              hasMany: true,
              label: 'Documents from the collection',
              admin: { description: 'Shown in date order. Only what the public may see of each item is shown to the public.' },
            },
            {
              name: 'elsewhere',
              type: 'array',
              label: 'Documents and resources elsewhere',
              labels: { singular: 'Link', plural: 'Links' },
              fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'url', type: 'text', required: true, validate: (v: unknown) => /^https?:\/\/\S+$/.test(String(v ?? '')) || 'A full web address' },
                { name: 'description', type: 'textarea' },
              ],
            },
          ],
        },
        {
          label: 'Sources',
          fields: [{ name: 'sources', type: 'richText' }],
        },
      ],
    },
    slugField('title'),
    {
      name: 'storyType',
      type: 'select',
      defaultValue: 'biography',
      options: [
        { label: 'Biography', value: 'biography' },
        { label: 'Theme', value: 'theme' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'decades', type: 'text', hasMany: true, admin: { position: 'sidebar', description: 'e.g. 1920s' } },
    { name: 'themes', type: 'text', hasMany: true, admin: { position: 'sidebar' } },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
    {
      name: 'origin',
      type: 'group',
      label: 'First published',
      admin: { position: 'sidebar', description: 'Where the story first appeared, if elsewhere.' },
      fields: [
        { name: 'site', type: 'text' },
        { name: 'url', type: 'text' },
        { name: 'license', type: 'text' },
        { name: 'licenseUrl', type: 'text' },
      ],
    },
  ],
}
