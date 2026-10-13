'use server'

import { APIError } from 'payload'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getViewer } from '@/lib/viewer'

/** Approve or return one annotation. The two-person rule is enforced by the collection, not here. */
export async function reviewAnnotation(formData: FormData) {
  const { payload, user } = await getViewer()
  const id = Number(formData.get('id'))
  const intent = formData.get('intent')
  const note = String(formData.get('reviewNote') ?? '').trim()
  let message: string
  try {
    if (!user) throw new APIError('Sign in to review annotations.', 401)
    if (!Number.isInteger(id)) throw new APIError('Unknown annotation.', 400)
    if (intent === 'approve') {
      await payload.update({ collection: 'annotations', id, user, overrideAccess: false, data: { status: 'approved', ...(note ? { reviewNote: note } : {}) } })
      message = 'Approved — the annotation is now public.'
    } else if (intent === 'return') {
      if (!note) throw new APIError('Say why it is being returned, so the author can fix it.', 400)
      await payload.update({ collection: 'annotations', id, user, overrideAccess: false, data: { status: 'rejected', reviewNote: note } })
      message = 'Returned to the author.'
    } else {
      throw new APIError('Unknown action.', 400)
    }
  } catch (err) {
    message = `Not done: ${err instanceof Error ? err.message : 'unexpected error'}`
  }
  revalidatePath('/review/annotations')
  revalidatePath('/items/[slug]', 'page')
  redirect(`/review/annotations?status=${encodeURIComponent(message)}`)
}
