import type { CollectionConfig } from 'payload'

import { editors, loggedIn } from '@/access/roles'

/**
 * Scans and other images. Files are served through Payload, so this collection's read access
 * governs the files themselves: an archival scan whose rights are not yet cleared must not be
 * reachable by guessing its URL. `public` is set automatically — on an item's pages when the item
 * is published, on a team photo when it is saved — and can be set by hand for anything else.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Content', defaultColumns: ['filename', 'alt', 'public'] },
  access: {
    read: ({ req }) => (req.user ? true : { public: { equals: true } }),
    create: loggedIn,
    update: loggedIn,
    delete: editors,
  },
  fields: [
    { name: 'alt', type: 'text', required: true, label: 'Alternative text' },
    {
      name: 'public',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Visible to the public. Set automatically for published items.' },
    },
    {
      name: 'sourceFilename',
      type: 'text',
      index: true,
      admin: { position: 'sidebar', readOnly: true, description: 'Original scan filename from the pipeline.' },
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
    adminThumbnail: 'thumbnail',
    imageSizes: [
      { name: 'thumbnail', width: 400 },
      { name: 'card', width: 800 },
      // Large enough to read handwriting on screen without shipping the 4–9 MB original.
      { name: 'reading', width: 2000 },
    ],
  },
}
