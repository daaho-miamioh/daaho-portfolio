import { addDataAndFileToRequest, APIError, type CollectionConfig, type PayloadRequest } from 'payload'

import { admins } from '@/access/roles'
import { LIMITS, REQUEST_KINDS, REQUEST_STATUSES } from '@/lib/accessRequests'
import { jsonEndpoint } from '@/lib/endpoint'
import { applyToJoin, approveRequest, declineRequest } from '@/lib/join'

const idOf = (req: PayloadRequest) => {
  const id = Number(req.routeParams?.id)
  if (!Number.isInteger(id)) throw new APIError('Unknown request.', 400)
  return id
}

// Set only by approving or declining (src/lib/join.ts, which bypasses access control).
const decisionOnly = { create: () => false, update: () => false }

/**
 * People asking to join the project, from the public form at /join. Only admins see them. Approving
 * creates the account and emails the invitation; declining closes the request. Requests come in only
 * through the form's endpoint, which checks them, so the collection itself accepts no new records.
 */
export const AccessRequests: CollectionConfig = {
  slug: 'access-requests',
  labels: { singular: 'Access request', plural: 'Access requests' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'kind', 'affiliation', 'createdAt'],
    listSearchableFields: ['name', 'email', 'affiliation'],
    group: 'Admin',
    description:
      'People asking to join the project, from the form at /join. Open a request to approve it, which creates their account and emails an invitation, or to decline it. Delete requests that are spam.',
  },
  defaultSort: '-createdAt',
  access: { read: admins, create: () => false, update: admins, delete: admins },
  endpoints: [
    {
      // The public form. Anyone may ask; nothing is granted until an admin approves.
      path: '/apply',
      method: 'post',
      handler: jsonEndpoint(async (req) => {
        await addDataAndFileToRequest(req)
        return applyToJoin(req, (req.data ?? {}) as Record<string, unknown>)
      }),
    },
    {
      path: '/:id/approve',
      method: 'post',
      handler: jsonEndpoint(
        async (req) => {
          await addDataAndFileToRequest(req)
          return approveRequest(req, idOf(req), String(req.data?.role ?? ''))
        },
        { admin: true, refusal: 'Only admins can approve requests.' },
      ),
    },
    {
      path: '/:id/decline',
      method: 'post',
      handler: jsonEndpoint(
        async (req) => {
          await addDataAndFileToRequest(req)
          return declineRequest(req, idOf(req), req.data?.notify === true)
        },
        { admin: true, refusal: 'Only admins can decline requests.' },
      ),
    },
  ],
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, maxLength: LIMITS.name },
        { name: 'email', type: 'email', required: true, index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'affiliation', type: 'text', label: 'Institution or community', maxLength: LIMITS.affiliation },
        { name: 'kind', type: 'select', label: 'Describes themselves as', required: true, options: [...REQUEST_KINDS] },
      ],
    },
    { name: 'reason', type: 'textarea', label: 'What they would like to do', required: true, maxLength: LIMITS.reason },
    { name: 'staffNote', type: 'textarea', label: 'Staff note', admin: { description: 'For admins only; never sent to them.' } },
    {
      name: 'decision',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '/components/admin/AccessDecision#AccessDecision' } },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [...REQUEST_STATUSES],
      index: true,
      access: decisionOnly,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'users',
      label: 'Account created',
      access: decisionOnly,
      admin: { position: 'sidebar', readOnly: true, condition: (data) => data?.status === 'approved' },
    },
    {
      name: 'decidedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Decided by',
      access: decisionOnly,
      admin: { position: 'sidebar', readOnly: true, condition: (data) => data?.status !== 'pending' },
    },
    {
      name: 'decidedAt',
      type: 'date',
      label: 'Decided on',
      access: decisionOnly,
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' }, condition: (data) => data?.status !== 'pending' },
    },
  ],
}
