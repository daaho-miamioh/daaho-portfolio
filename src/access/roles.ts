import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

export type Role = 'admin' | 'editor' | 'contributor'

export const ROLES: { label: string; value: Role }[] = [
  { label: 'Admin — everything, including user accounts', value: 'admin' },
  { label: 'Editor — edit and publish', value: 'editor' },
  { label: 'Contributor — draft and edit, cannot publish', value: 'contributor' },
]

const roleOf = (req: PayloadRequest): Role | undefined => (req.user as { role?: Role } | null)?.role

export const hasRole = (req: PayloadRequest, ...roles: Role[]) => {
  const role = roleOf(req)
  return !!role && roles.includes(role)
}

export const anyone: Access = () => true
export const loggedIn: Access = ({ req }) => !!req.user
export const admins: Access = ({ req }) => hasRole(req, 'admin')
export const editors: Access = ({ req }) => hasRole(req, 'admin', 'editor')
export const adminsField: FieldAccess = ({ req }) => hasRole(req, 'admin')

/** Public sees published documents only; anyone signed in to the CMS sees drafts too. */
export const publishedOrLoggedIn: Access = ({ req }) => {
  if (req.user) return true
  return { _status: { equals: 'published' } } satisfies Where
}
