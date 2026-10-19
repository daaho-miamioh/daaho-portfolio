import { addDataAndFileToRequest, APIError, type CollectionConfig, type PayloadHandler, type PayloadRequest } from 'payload'

import { admins, adminsField, hasRole, loggedIn, ROLES } from '@/access/roles'
import { emailConfigured } from '@/lib/email'
import { inviteNewUser, sendInvitation, siteOrigin } from '@/lib/invite'

/** Admins only; errors come back as JSON the invitation panel can show. */
const adminEndpoint =
  (run: (req: PayloadRequest) => Promise<unknown>): PayloadHandler =>
  async (req) => {
    try {
      if (!hasRole(req, 'admin')) throw new APIError('Only admins can invite people.', 403)
      return Response.json(await run(req))
    } catch (err) {
      const status = err instanceof APIError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      return Response.json({ errors: [{ message }] }, { status })
    }
  }

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role', 'invitedAt'],
    group: 'Admin',
    description: 'Use Invite someone to add people: they get an email with a link to choose their own password.',
    components: { beforeListTable: ['/components/admin/InvitePanel#InvitePanel'] },
  },
  auth: {
    // Invitations set their own three-day expiry (src/lib/invite.ts); this is the email for the
    // ordinary "Forgot password?" link, which keeps Payload's one-hour expiry.
    forgotPassword: {
      generateEmailSubject: () => 'Reset your DAAHO password',
      generateEmailHTML: (args) => {
        // Without email set up, Payload only logs the message; no link is needed, and none is guessed.
        if (!emailConfigured()) return '<p>Password reset requested; email is not set up on this site.</p>'
        const req = args?.req as PayloadRequest
        const link = `${siteOrigin(req)}/admin/reset/${args?.token}`
        return `<p>Someone asked to reset the password for your DAAHO account.</p>
<p><a href="${link}">Choose a new password</a> (this link works once, for one hour).</p>
<p>If that was not you, ignore this email; your password has not changed.</p>`
      },
    },
  },
  access: {
    // Everyone signed in can see who else is on the project; only admins manage accounts.
    read: loggedIn,
    create: admins,
    delete: admins,
    update: ({ req, id }) => hasRole(req, 'admin') || req.user?.id === id,
  },
  endpoints: [
    {
      // Create an account and email its owner a link to choose their password.
      path: '/invite',
      method: 'post',
      handler: adminEndpoint(async (req) => {
        await addDataAndFileToRequest(req)
        return inviteNewUser(req, (req.data ?? {}) as Record<string, unknown>)
      }),
    },
    {
      // A fresh link for someone whose invitation expired or went astray.
      path: '/:id/invite',
      method: 'post',
      handler: adminEndpoint(async (req) => {
        const id = Number(req.routeParams?.id)
        if (!Number.isInteger(id)) throw new APIError('Unknown user.', 400)
        return sendInvitation(req, id)
      }),
    },
  ],
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'contributor',
      options: ROLES,
      // Users may edit their own profile, but never their own role.
      access: { update: adminsField },
      saveToJWT: true,
    },
    {
      name: 'invitation',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '/components/admin/InviteButton#InviteButton' } },
    },
    // Set only by the invitation code (which bypasses access control), never through the API.
    {
      name: 'invitedAt',
      type: 'date',
      label: 'Last invited',
      access: { create: () => false, update: () => false },
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      access: { create: () => false, update: () => false },
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
  hooks: {
    beforeChange: [
      // The account created on the first-run screen must be able to manage everyone else.
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({ collection: 'users', req })
          if (totalDocs === 0) data.role = 'admin'
        }
        return data
      },
    ],
  },
}
