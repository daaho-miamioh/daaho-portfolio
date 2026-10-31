import type { CollectionConfig } from 'payload'

import { admins } from '@/access/roles'
import { ACTIONS } from '@/lib/activity'

/**
 * Who did what, and when: every change to any record or setting, and every sign-in. Written only by
 * the hooks in src/hooks/activity.ts (which bypass access control); nobody can add, edit or delete an
 * entry, admins included, so the log can be trusted as a record.
 */
export const ActivityLog: CollectionConfig = {
  slug: 'activity',
  labels: { singular: 'Log entry', plural: 'Activity log' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'createdAt', 'action'],
    listSearchableFields: ['summary', 'who', 'recordTitle'],
    group: 'Admin',
    description: 'Every change anyone makes here, and every sign-in, newest first. Entries cannot be edited or deleted. Open one to see what changed.',
  },
  defaultSort: '-createdAt',
  access: { read: admins, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'summary', type: 'text', required: true },
    // Payload's own timestamp, named and shown to the second, as a log needs.
    {
      name: 'createdAt',
      type: 'date',
      label: 'When',
      index: true,
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'yyyy-MM-dd HH:mm:ss' } },
    },
    { name: 'action', type: 'select', required: true, options: [...ACTIONS], index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'user',
          type: 'relationship',
          relationTo: 'users',
          label: 'By',
          index: true,
          admin: { description: 'Empty when no one was signed in: an import script, or a failed sign-in.' },
        },
        // Kept as written at the time, so the entry still names them if the account is later removed.
        { name: 'who', type: 'text', label: 'Name at the time' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'recordType', type: 'text', label: 'Type of record', index: true },
        { name: 'recordId', type: 'text', label: 'Record ID', index: true },
        { name: 'recordTitle', type: 'text', label: 'Record' },
      ],
    },
    {
      name: 'record',
      type: 'ui',
      admin: { components: { Field: '/components/admin/ActivityEntry#RecordLink' } },
    },
    {
      name: 'changes',
      type: 'json',
      label: 'What changed',
      admin: { components: { Field: '/components/admin/ActivityEntry#Changes' } },
    },
  ],
}
