import type { CollectionConfig } from 'payload'

import { editors, loggedIn, publishedOrLoggedIn } from '@/access/roles'
import { slugField } from '@/fields/slug'
import { deriveYears, eventPublishGate } from '@/hooks/events'
import { stampReview } from '@/hooks/items'
import { REGIONS } from '@/lib/regions'

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/
const validDate = (required: boolean) => (value: unknown) =>
  (!required && !value) || (typeof value === 'string' && DATE.test(value)) || 'Use YYYY, YYYY-MM or YYYY-MM-DD.'

/**
 * Events in East Asian and Asian American history, shown as context beside items of the same years
 * and regions. Context, not description: an item is never claimed to mention an event.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  labels: { singular: 'Historical event', plural: 'Historical events' },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'startDate', 'regions', 'review.status', '_status'],
    description: 'Shown as historical context beside items from the same years and regions. Public only after review, with a source.',
  },
  defaultSort: 'startYear',
  // Drafts are validated too. Payload skips validation on drafts by default, and an event saved with
  // a date like "July 1937" would get no year — and silently never match any item.
  versions: { drafts: { validate: true }, maxPerDoc: 25 },
  access: { read: publishedOrLoggedIn, create: loggedIn, update: loggedIn, delete: editors },
  hooks: { beforeChange: [eventPublishGate, stampReview, deriveYears] },
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'English name, e.g. Marco Polo Bridge Incident' } },
    slugField('title'),
    {
      name: 'names',
      type: 'array',
      labels: { singular: 'Name in another language', plural: 'Names in other languages' },
      admin: { description: 'Names differ between Chinese, Japanese and Korean historiography; list each rather than choosing one.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'language',
              type: 'select',
              required: true,
              options: [
                { label: 'Chinese', value: 'zh' },
                { label: 'Japanese', value: 'ja' },
                { label: 'Korean', value: 'ko' },
                { label: 'Thai', value: 'th' },
                { label: 'Burmese', value: 'my' },
                { label: 'Filipino', value: 'fil' },
              ],
            },
            { name: 'name', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'startDate', type: 'text', required: true, validate: validDate(true), admin: { description: 'YYYY, YYYY-MM or YYYY-MM-DD' } },
        { name: 'endDate', type: 'text', validate: validDate(false), admin: { description: 'For a period; leave empty for a single event' } },
      ],
    },
    { name: 'regions', type: 'select', hasMany: true, required: true, options: REGIONS.map((r) => ({ label: r, value: r })),
      admin: { description: 'The communities it concerns. A U.S. law is tagged with the groups it affected: the Chinese Exclusion Act is China.' } },
    { name: 'importance', type: 'select', defaultValue: 'notable', options: [{ label: 'Major', value: 'major' }, { label: 'Notable', value: 'notable' }] },
    { name: 'summary', type: 'textarea', required: true, maxLength: 400, admin: { description: 'One or two neutral sentences.' } },
    {
      name: 'sources',
      type: 'array',
      admin: { description: 'At least one is required before publishing.' },
      fields: [
        { name: 'citation', type: 'text', required: true },
        { name: 'url', type: 'text' },
      ],
    },
    { name: 'startYear', type: 'number', index: true, admin: { position: 'sidebar', readOnly: true } },
    { name: 'endYear', type: 'number', index: true, admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'review',
      type: 'group',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'ai_drafted',
          options: [
            { label: 'AI-drafted, not reviewed', value: 'ai_drafted' },
            { label: 'Reviewed', value: 'reviewed' },
          ],
        },
        { name: 'reviewedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        { name: 'reviewedAt', type: 'date', admin: { readOnly: true } },
        { name: 'notes', type: 'textarea' },
      ],
    },
    { name: 'draftedBy', type: 'text', admin: { position: 'sidebar', readOnly: true, description: 'Who or what wrote the first draft.' } },
  ],
}
