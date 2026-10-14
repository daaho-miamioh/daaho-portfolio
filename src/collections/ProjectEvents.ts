import type { CollectionConfig } from 'payload'

import { editors, publishedOrLoggedIn } from '@/access/roles'
import { slugField } from '@/fields/slug'
import { validDay } from '@/lib/eventDates'
import { makeMediaPublic } from '@/lib/publicMedia'

export const EVENT_KINDS = [
  { label: 'Exhibit', value: 'exhibit' },
  { label: 'Conference', value: 'conference' },
  { label: 'Community event', value: 'community' },
  { label: 'Talk', value: 'talk' },
  { label: 'Workshop', value: 'workshop' },
  { label: 'Launch', value: 'launch' },
  { label: 'Other', value: 'other' },
] as const

/**
 * The project's own events — exhibits, talks, conferences — for the Events page. Not to be confused
 * with Historical events, which give context to items. Upcoming and past are worked out from the
 * dates, so nothing has to be moved by hand when an event is over.
 */
export const ProjectEvents: CollectionConfig = {
  slug: 'project-events',
  labels: { singular: 'Project event', plural: 'Project events' },
  admin: {
    useAsTitle: 'title',
    group: 'Site',
    defaultColumns: ['title', 'start', 'location', '_status'],
    description: 'Exhibits, talks and conferences. Shown as upcoming until their last day, then as past events.',
  },
  defaultSort: '-start',
  versions: { drafts: true, maxPerDoc: 25 },
  access: { read: publishedOrLoggedIn, create: editors, update: editors, delete: editors },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        if (doc._status === 'published') await makeMediaPublic(req, (doc.images ?? []).map((r: { image: unknown }) => r.image))
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    { name: 'kind', type: 'select', defaultValue: 'other', options: [...EVENT_KINDS], admin: { position: 'sidebar' } },
    {
      type: 'row',
      fields: [
        { name: 'start', type: 'text', required: true, label: 'First day', validate: (v: unknown) => validDay(v, true), admin: { placeholder: 'YYYY-MM-DD', width: '50%' } },
        { name: 'end', type: 'text', label: 'Last day', validate: (v: unknown) => validDay(v), admin: { placeholder: 'YYYY-MM-DD — leave empty for one day', width: '50%' } },
      ],
    },
    { name: 'timeText', type: 'text', label: 'Time', admin: { description: 'e.g. 10 AM – 12 PM, or "Community event: October 25, 10 AM – 12 PM"' } },
    { name: 'location', type: 'text' },
    {
      name: 'link',
      type: 'text',
      label: 'Event link',
      validate: (v: unknown) => !v || /^https?:\/\/\S+$/.test(String(v)) || 'Use a full web address starting with https://',
      admin: { description: 'Registration or more information, on another site. Optional.' },
    },
    { name: 'summary', type: 'textarea', required: true, maxLength: 400, admin: { description: 'One or two sentences, shown in event lists.' } },
    { name: 'description', type: 'textarea', admin: { rows: 12, description: 'The full text. Leave a blank line between paragraphs.' } },
    {
      name: 'images',
      type: 'array',
      labels: { singular: 'Image', plural: 'Images' },
      admin: { description: 'Flyers and photographs. Each image needs alternative text, set on the image itself.' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'sponsors',
      type: 'array',
      labels: { singular: 'Sponsor', plural: 'Sponsors' },
      fields: [{ name: 'name', type: 'text', required: true }],
    },
  ],
}
