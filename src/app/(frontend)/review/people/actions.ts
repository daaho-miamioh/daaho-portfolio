'use server'

import { APIError } from 'payload'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { markNotDuplicates, mergePeople } from '@/lib/mergePeople'
import { getViewer } from '@/lib/viewer'
import type { User } from '@/payload-types'

/** One form per cluster: keep one record, and either merge the checked ones into it or mark them different. */
export async function reviewCluster(formData: FormData) {
  const { payload, user } = await getViewer()
  const ids = (key: string) => formData.getAll(key).map(Number).filter(Number.isInteger)
  const intent = formData.get('intent')
  const keep = Number(formData.get('keep'))
  const chosen = ids('selected')
  let message: string
  try {
    if (!user) throw new APIError('Sign in to review duplicates.', 401)
    if (intent === 'merge') {
      if (!Number.isInteger(keep)) throw new APIError('Choose the record to keep.', 400)
      const { merged, itemsUpdated } = await mergePeople(payload, user as User, keep, chosen)
      message = `Merged ${merged.join('; ')} — ${itemsUpdated} item${itemsUpdated === 1 ? '' : 's'} updated.`
    } else if (intent === 'different') {
      const group = [...new Set([...(Number.isInteger(keep) ? [keep] : []), ...chosen])]
      await markNotDuplicates(payload, user as User, group)
      message = `Marked ${group.length} records as different people.`
    } else {
      throw new APIError('Unknown action.', 400)
    }
  } catch (err) {
    message = `Not done: ${err instanceof Error ? err.message : 'unexpected error'}`
  }
  revalidatePath('/review/people')
  redirect(`/review/people?status=${encodeURIComponent(message)}`)
}
