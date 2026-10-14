import type { PayloadRequest } from 'payload'

const idOf = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number }).id : (v as number | null | undefined))

/**
 * Mark uploads as public. Scans stay private until their item is published (see the media
 * collection); images chosen for site pages — portraits, flyers, logos, slides — are public as soon
 * as the page they appear on is.
 */
export async function makeMediaPublic(req: PayloadRequest, refs: unknown[]) {
  const ids = [...new Set(refs.map(idOf).filter((id): id is number => typeof id === 'number'))]
  if (!ids.length) return
  await req.payload.update({ collection: 'media', where: { id: { in: ids } }, data: { public: true }, req, overrideAccess: true })
}
