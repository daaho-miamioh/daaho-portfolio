import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

/**
 * Every page reads through the Local API *with* the visitor's identity, so the same access rules
 * that protect the API protect the pages: the public sees published items only, signed-in staff
 * also see drafts.
 */
export async function getViewer() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  return { payload, user, draft: !!user, access: { overrideAccess: false as const, user } }
}
