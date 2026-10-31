import type { CollectionConfig } from 'payload'

import { editors, publishedOrLoggedIn } from '@/access/roles'
import { slugField } from '@/fields/slug'
import { makeMediaPublic } from '@/lib/publicMedia'

/** Each collection's colour on its card, its page and its items' cards. The values are in styles.css (.set-red …). */
export const SET_COLORS = [
  { label: 'Red', value: 'red' },
  { label: 'Blue', value: 'blue' },
  { label: 'Green', value: 'green' },
  { label: 'Amber', value: 'amber' },
  { label: 'Violet', value: 'violet' },
  { label: 'Slate', value: 'slate' },
] as const

/**
 * Collections within the collection: one archive's letters, a run of festival programs, a library's
 * oral histories. Each item belongs to one, by where it comes from, so a visitor has a way in by
 * source and a researcher can keep to one body of records. Themes that cross them are subjects and
 * stories, not collections.
 *
 * A collection's page shows only the items its visitor can see, and the public is not shown a
 * collection with none.
 */
export const Sets: CollectionConfig = {
  slug: 'sets',
  labels: { singular: 'Collection', plural: 'Collections' },
  // Not "Set", which would shadow JavaScript's own Set wherever the types are imported.
  typescript: { interface: 'ItemSet' },
  graphQL: { singularName: 'ItemSet', pluralName: 'ItemSets' },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'holder', 'order', '_status'],
    description: "Groups of items by where they come from, each with its own page. An item's collection is set in its sidebar.",
  },
  defaultSort: 'order',
  versions: { drafts: true, maxPerDoc: 25 },
  access: { read: publishedOrLoggedIn, create: editors, update: editors, delete: editors },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        if (doc._status === 'published') await makeMediaPublic(req, [doc.cover])
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          type: 'text',
          label: 'What it holds',
          admin: { width: '50%', description: 'Two or three words, shown above its title: e.g. Festival programs, Oral histories.' },
        },
        {
          name: 'shortTitle',
          type: 'text',
          label: 'Short name',
          admin: { width: '50%', description: 'On item cards and item pages, e.g. AsianFest programs. Its title if empty.' },
        },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: { description: 'One sentence for its card and the top of its page: what sets it apart from the other collections.' },
    },
    {
      name: 'intro',
      type: 'richText',
      label: 'About this collection',
      admin: { description: 'What it is, who made it, and how it came to the project.' },
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Optional. Without one, its card shows the first scan among its items.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'holder', type: 'text', label: 'Held by', admin: { width: '50%', description: 'The institution that holds the originals.' } },
        {
          name: 'url',
          type: 'text',
          label: 'The collection at its holder',
          validate: (v: string | null | undefined) => !v || /^https?:\/\/\S+$/.test(v) || 'A full web address, starting https://',
          admin: { width: '50%', description: "Its page on the holder's website." },
        },
      ],
    },
    {
      name: 'rights',
      type: 'textarea',
      admin: { description: "For the collection as a whole. Each item's own rights statement still applies." },
    },
    slugField('title'),
    {
      name: 'color',
      type: 'select',
      required: true,
      defaultValue: 'slate',
      options: [...SET_COLORS],
      admin: { position: 'sidebar', description: 'So its cards, page and items can be told apart at a glance. Give each collection its own.' },
    },
    { name: 'order', type: 'number', admin: { position: 'sidebar', description: 'Lower numbers are listed first.' } },
  ],
}
