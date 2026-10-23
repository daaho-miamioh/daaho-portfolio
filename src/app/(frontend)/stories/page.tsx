import type { Metadata } from 'next'

import { StoryGrid } from '@/components/StoryCard'
import { getViewer } from '@/lib/viewer'
import type { Story } from '@/payload-types'

export const metadata: Metadata = {
  title: 'Stories',
  description: 'Lives and themes from Asian American history in Ohio, told beside the documents that record them.',
}

export default async function StoriesPage() {
  const { payload, draft, access } = await getViewer()
  const stories = (await payload.find({ collection: 'stories', pagination: false, depth: 1, draft, sort: 'title', ...access })).docs as Story[]
  return (
    <>
      <p className="eyebrow">Stories</p>
      <h1>Lives in the collection</h1>
      <p className="lede">
        Biographies written by students and staff of the project, each set beside the letters and records in the
        collection that tell part of it.
      </p>
      {stories.length ? <StoryGrid stories={stories} /> : <p className="empty">No stories yet.</p>}
    </>
  )
}
