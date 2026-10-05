import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { hasRole } from '@/access/roles'

/**
 * Historical context is drafted with AI, and AI gets dates, numbers and names wrong. It sits beside
 * archival documents on a university library's site, so it is held to the same rule as the items:
 * nothing is public until a person has checked it, and every event must cite where it can be checked.
 */
export const eventPublishGate: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (data._status !== 'published') return data
  if (req.user && !hasRole(req, 'admin', 'editor')) {
    throw new APIError('Contributors can save drafts but cannot publish. Ask an editor to publish.', 403)
  }
  const status = data.review?.status ?? originalDoc?.review?.status
  const sources = (data.sources ?? originalDoc?.sources ?? []).filter((s: { citation?: string }) => s?.citation?.trim())
  const missing = [status !== 'reviewed' && 'mark the event as Reviewed', !sources.length && 'add at least one source'].filter(Boolean)
  if (missing.length) throw new APIError(`Before publishing: ${missing.join(' and ')}.`, 400)
  return data
}

const YEAR = /^(\d{4})/
export const deriveYears: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const start = data.startDate ?? originalDoc?.startDate
  const end = data.endDate === undefined ? originalDoc?.endDate : data.endDate
  data.startYear = start && YEAR.test(start) ? Number(YEAR.exec(start)![1]) : null
  data.endYear = end && YEAR.test(end) ? Number(YEAR.exec(end)![1]) : null
  return data
}
