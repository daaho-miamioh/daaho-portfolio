import type { GlobalConfig } from 'payload'

import { anyone, editors } from '@/access/roles'

/**
 * Decisions the PI makes once for the whole site. Every scan is Miami University's, so one rights
 * statement can cover the collection; whether the public may open full-resolution files is pending.
 */
export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Site settings',
  admin: { group: 'Site' },
  access: { read: anyone, update: editors },
  fields: [
    {
      name: 'defaultRights',
      type: 'textarea',
      label: 'Default rights statement',
      admin: {
        description:
          'Shown on every item without its own rights statement, and counts as the rights statement required to publish. An item\'s own statement takes precedence.',
      },
    },
    {
      name: 'allowFullResolution',
      type: 'checkbox',
      defaultValue: false,
      label: 'Public can open full-resolution scans',
      admin: {
        description:
          'Off: the public sees reading-size images only (2000 px). Signed-in staff can always open originals. Pending the PI\'s decision.',
      },
    },
  ],
}
