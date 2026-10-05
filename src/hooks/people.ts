import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { hasRole } from '@/access/roles'

/** A biography is editorial content: contributors draft it, editors publish it. */
export const publishGate: CollectionBeforeChangeHook = ({ data, req }) => {
  if (data._status === 'published' && req.user && !hasRole(req, 'admin', 'editor')) {
    throw new APIError('Contributors can save drafts but cannot publish. Ask an editor to publish.', 403)
  }
  return data
}
