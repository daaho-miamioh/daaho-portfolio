import {
  AuthenticationError,
  LockedAuth,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionAfterErrorHook,
  type CollectionAfterLoginHook,
  type CollectionAfterLogoutHook,
  type CollectionAfterOperationHook,
  type CollectionBeforeChangeHook,
  type CollectionSlug,
  type Config,
  type Field,
  type GlobalAfterChangeHook,
  type PayloadRequest,
} from 'payload'
import { fieldAffectsData } from 'payload/shared'

import { ActivityLog } from '@/collections/ActivityLog'
import { type Action, type Changes, changesBetween, snapshot, titleOf } from '@/lib/activity'

type Person = { id: number; name?: string | null; email?: string | null }
type Entry = { action: Action; summary: string; who?: Person | null; type?: string; id?: number | string; title?: string; changes?: Changes }

/** The person acting, as the log names them; with no one signed in, an import script or the like. */
function nameOf(req: PayloadRequest, person: Person | null = req.user as Person | null) {
  if (person) return person.name || person.email || `User #${person.id}`
  return req.payloadAPI === 'local' ? 'A script' : 'Someone'
}

const labelOf = (label: unknown, slug: string) => (typeof label === 'string' ? label : slug)

/** Fields nobody sees in the admin, which the code keeps up to date: not changes anyone made. */
const unseen = (fields: Field[]) =>
  new Set(fields.flatMap((f) => (fieldAffectsData(f) && (f.hidden || f.admin?.hidden) ? [f.name] : [])))

/**
 * Write an entry. Inside the operation's transaction, so a save that fails leaves no entry and an
 * entry that cannot be written fails the save; `outside` is for errors, whose transaction is gone.
 */
async function record(req: PayloadRequest, entry: Entry, outside = false) {
  const who = entry.who === undefined ? (req.user as Person | null) : entry.who
  const data = {
    summary: entry.summary,
    action: entry.action,
    user: who?.id ?? null,
    who: who ? nameOf(req, who) : null,
    recordType: entry.type ?? null,
    recordId: entry.id === undefined ? null : String(entry.id),
    recordTitle: entry.title ?? null,
    changes: entry.changes && Object.keys(entry.changes).length ? entry.changes : null,
  }
  if (!outside) {
    await req.payload.create({ collection: 'activity', data, overrideAccess: true, req })
    return
  }
  try {
    await req.payload.create({ collection: 'activity', data, overrideAccess: true })
  } catch (err) {
    req.payload.logger.error({ err, msg: 'Could not write to the activity log' })
  }
}

const mainStatus = async (req: PayloadRequest, collection: string, id: number | string) =>
  (await req.payload.db.findOne<{ id: number; _status?: string }>({ collection: collection as CollectionSlug, where: { id: { equals: id } }, req }))?._status

const stashKey = (collection: string, id: unknown) => `activity:${collection}:${id}`
type Stash = { published?: boolean; password?: boolean }

/**
 * Before a save, note what the save itself will hide: whether the record was public (a draft saved
 * over a published record and an unpublished record look alike afterwards) and whether a new
 * password is being set (Payload drops it from the data before the after-hooks run).
 */
const noteBefore: CollectionBeforeChangeHook = async ({ collection, context, data, operation, originalDoc, req }) => {
  if (operation === 'update' && originalDoc) {
    const stash: Stash = { password: !!data.password }
    if (collection.versions?.drafts) stash.published = (await mainStatus(req, collection.slug, originalDoc.id)) === 'published'
    context[stashKey(collection.slug, originalDoc.id)] = stash
  }
  return data
}

const logChange: CollectionAfterChangeHook = async ({ collection, context, doc, operation, previousDoc, req }) => {
  const label = labelOf(collection.labels.singular, collection.slug)
  const title = titleOf(doc, collection.admin?.useAsTitle)
  const about = { type: collection.slug, id: doc.id, title }
  if (operation === 'create') {
    const published = doc._status === 'published' ? ' and published it' : ''
    await record(req, { ...about, action: 'create', summary: `${nameOf(req)} created ${label} “${title}”${published}` })
    return doc
  }

  const key = stashKey(collection.slug, doc.id)
  const before = (context[key] ?? {}) as Stash
  delete context[key]
  const changes = changesBetween(previousDoc, doc, unseen(collection.fields))
  if (before.password) changes.password = { from: null, to: 'changed' }

  let action: Action = 'update'
  let verb = 'updated'
  if (collection.versions?.drafts) {
    const published = (await mainStatus(req, collection.slug, doc.id)) === 'published'
    if (published && !before.published) [action, verb] = ['publish', 'published']
    else if (!published && before.published) [action, verb] = ['unpublish', 'unpublished']
    else if (published && doc._status === 'draft') verb = 'saved a draft of changes to'
  }
  // The invitation code stamps the account; the stamp is the invitation.
  if (collection.slug === 'users' && 'invitedAt' in changes) [action, verb] = ['invite', 'invited']
  // A save that changed nothing (a second click, or a hook re-saving) is not worth an entry.
  if (action === 'update' && !Object.keys(changes).length) return doc
  await record(req, { ...about, action, changes, summary: `${nameOf(req)} ${verb} ${label} “${title}”` })
  return doc
}

const logDelete: CollectionAfterDeleteHook = async ({ collection, doc, req }) => {
  const label = labelOf(collection.labels.singular, collection.slug)
  const title = titleOf(doc, collection.admin?.useAsTitle)
  await record(req, { type: collection.slug, id: doc.id, title, action: 'delete', changes: snapshot(doc, unseen(collection.fields)), summary: `${nameOf(req)} deleted ${label} “${title}”` })
  return doc
}

const logGlobalChange: GlobalAfterChangeHook = async ({ doc, global, previousDoc, req }) => {
  const changes = changesBetween(previousDoc, doc, unseen(global.fields))
  const label = labelOf(global.label, global.slug)
  if (Object.keys(changes).length) {
    await record(req, { type: global.slug, title: label, action: 'update', changes, summary: `${nameOf(req)} updated ${label}` })
  }
  return doc
}

const logLogin: CollectionAfterLoginHook = async ({ req, user }) => {
  await record(req, { action: 'login', who: user, summary: `${nameOf(req, user)} signed in` })
  return user
}

const logLogout: CollectionAfterLogoutHook = async ({ req }) => {
  if (req.user) await record(req, { action: 'logout', summary: `${nameOf(req)} signed out` })
}

const logFailedLogin: CollectionAfterErrorHook = async ({ error, req }) => {
  if (!(error instanceof AuthenticationError || error instanceof LockedAuth)) return
  const email = typeof req.data?.email === 'string' ? req.data.email.slice(0, 200) : 'an unknown address'
  const locked = error instanceof LockedAuth ? ' (account locked after too many tries)' : ''
  await record(req, { action: 'login_failed', who: null, summary: `Sign-in failed for ${email}${locked}` }, true)
}

const logPasswordReset: CollectionAfterOperationHook = async ({ args, collection, operation, req, result }) => {
  // With an admin signed in, this is an invitation link being made; the invitation is logged instead.
  if (operation === 'forgotPassword' && result && !req.user) {
    const email = (args as { data?: { email?: string } }).data?.email
    const account = email
      ? ((await req.payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0] as Person | undefined)
      : undefined
    if (account) {
      const title = titleOf(account as Record<string, unknown>, collection.admin?.useAsTitle)
      await record(req, { type: collection.slug, id: account.id, title, action: 'reset_requested', who: null, summary: `Someone asked to reset the password of “${title}”` })
    }
  }
  if (operation === 'resetPassword') {
    const user = (result as { user?: Person } | undefined)?.user
    if (user) await record(req, { action: 'password', who: user, summary: `${nameOf(req, user)} set a new password` })
  }
  return result
}

/**
 * Logs every change to every collection and global, and sign-ins on every collection people sign in
 * to, into the Activity log (src/collections/ActivityLog.ts), which it adds. A plugin, so a
 * collection added later is logged without anyone remembering to.
 */
export const activityLog = (config: Config): Config => ({
  ...config,
  collections: [
    ...(config.collections ?? []).map((c) => ({
      ...c,
      hooks: {
        ...c.hooks,
        beforeChange: [...(c.hooks?.beforeChange ?? []), noteBefore],
        afterChange: [...(c.hooks?.afterChange ?? []), logChange],
        afterDelete: [...(c.hooks?.afterDelete ?? []), logDelete],
        ...(c.auth && {
          afterLogin: [...(c.hooks?.afterLogin ?? []), logLogin],
          afterLogout: [...(c.hooks?.afterLogout ?? []), logLogout],
          afterError: [...(c.hooks?.afterError ?? []), logFailedLogin],
          afterOperation: [...(c.hooks?.afterOperation ?? []), logPasswordReset],
        }),
      },
    })),
    ActivityLog,
  ],
  globals: (config.globals ?? []).map((g) => ({ ...g, hooks: { ...g.hooks, afterChange: [...(g.hooks?.afterChange ?? []), logGlobalChange] } })),
})
