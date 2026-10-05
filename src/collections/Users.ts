import type { CollectionConfig } from 'payload'

import { admins, adminsField, hasRole, loggedIn, ROLES } from '@/access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Admin',
  },
  auth: true,
  access: {
    // Everyone signed in can see who else is on the project; only admins manage accounts.
    read: loggedIn,
    create: admins,
    delete: admins,
    update: ({ req, id }) => hasRole(req, 'admin') || req.user?.id === id,
  },
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
