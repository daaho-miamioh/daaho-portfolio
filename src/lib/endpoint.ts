import { APIError, type PayloadHandler, type PayloadRequest } from 'payload'

import { hasRole } from '@/access/roles'

/**
 * An endpoint that answers in JSON, its errors as { errors: [{ message, data? }] }, the shape the
 * admin panels and the join form read. With `admin`, everyone else is refused. On a public endpoint
 * an unexpected error is logged and answered generically, so it never shows the public our internals.
 */
export const jsonEndpoint =
  (run: (req: PayloadRequest) => Promise<unknown>, { admin = false, refusal = 'Only admins can do this.' } = {}): PayloadHandler =>
  async (req) => {
    try {
      if (admin && !hasRole(req, 'admin')) throw new APIError(refusal, 403)
      return Response.json(await run(req))
    } catch (err) {
      const known = err instanceof APIError
      if (!known) req.payload.logger.error({ err, msg: `${req.method} ${req.url} failed` })
      const status = known ? err.status : 500
      const message = known || admin ? (err instanceof Error ? err.message : 'Something went wrong.') : 'Something went wrong. Please try again later.'
      const data = known && err.data ? { data: err.data } : {}
      return Response.json({ errors: [{ message, ...data }] }, { status })
    }
  }
