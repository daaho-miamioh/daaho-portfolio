import type { Payload, Where } from 'payload'

import { isUpcoming, todayInOhio } from '@/lib/eventDates'
import type { getViewer } from '@/lib/viewer'
import type { ProjectEvent } from '@/payload-types'

type Viewer = Pick<Awaited<ReturnType<typeof getViewer>>, 'draft' | 'access'>

/** Project events this visitor may see, split by today's date in Ohio: soonest upcoming first, latest past first. */
export async function loadProjectEvents(payload: Payload, { draft, access }: Viewer, where?: Where) {
  const { docs } = await payload.find({ collection: 'project-events', pagination: false, depth: 1, draft, sort: 'start', where, ...access })
  const today = todayInOhio()
  const events = docs as ProjectEvent[]
  return {
    upcoming: events.filter((e) => isUpcoming(e, today)),
    past: events.filter((e) => !isUpcoming(e, today)).reverse(),
  }
}
