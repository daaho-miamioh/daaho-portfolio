import type { Access, CollectionConfig, Where } from 'payload'

import { editors, loggedIn } from '@/access/roles'

/**
 * Scans and other images. Files are served through Payload, so this collection's read access
 * governs the files themselves: an archival scan whose rights are not yet cleared must not be
 * reachable by guessing its URL. `public` is set automatically — on an item's pages when the item
 * is published, on a team photo when it is saved — and can be set by hand for anything else.
 */
/**
 * The public may read a file only if it is public; and, until Site settings allow full resolution, only
 * the derived sizes, not the original. Hiding the link alone would not do: file URLs are predictable
 * (/api/media/file/AAMU-0001_Recto.jpg). Each size has its own filename, so the original is refused by
 * name while the reading-size image of the same scan is served.
 */
export const readMedia: Access = async ({ req }) => {
  if (req.user) return true
  const visible: Where = { public: { equals: true } }
  const requested = (req.routeParams as { filename?: string } | undefined)?.filename
  if (!requested) return visible
  const settings = await req.payload.findGlobal({ slug: 'settings', req, depth: 0, overrideAccess: true })
  if (settings.allowFullResolution) return visible
  return { and: [visible, { filename: { not_equals: requested } }] }
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Content', defaultColumns: ['filename', 'alt', 'public'] },
  access: {
    read: readMedia,
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
