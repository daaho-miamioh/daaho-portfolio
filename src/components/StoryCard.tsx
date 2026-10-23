import Link from 'next/link'

import { asMedia, src } from '@/lib/media'
import type { Story } from '@/payload-types'

/** The decades as a span when they run on (1900s–1940s), so they fit on the card's one line; otherwise listed. */
function decadesLabel(decades: string[]): string {
  const years = decades.map((d) => parseInt(d, 10)).sort((a, b) => a - b)
  const runOn = years.length > 2 && years.every((y, i) => !Number.isNaN(y) && (i === 0 || y === years[i - 1] + 10))
  return runOn ? `${years[0]}s–${years.at(-1)}s` : decades.join(' · ')
}

export function StoryCard({ story }: { story: Story }) {
  const portrait = asMedia(story.subject?.portrait)
  const docs = (story.documents ?? []).length
  return (
    <li className="story-card">
      <Link href={`/stories/${story.slug}`} className="story-card-link">
        <div className="story-card-image">
          {portrait ? (
            // Decorative: the name below says who it is.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(portrait, 'card')} alt="" loading="lazy" />
          ) : (
            <span className="card-noimage" aria-hidden="true" />
          )}
        </div>
        <div className="story-card-body">
          {(story.decades ?? []).length > 0 && <p className="story-card-eyebrow">{decadesLabel(story.decades ?? [])}</p>}
          <h3 className="story-card-title">{story.title}</h3>
          {story.subject?.lifeDates && <p className="card-meta">{story.subject.lifeDates}</p>}
          {story.dek && <p className="story-card-dek">{story.dek}</p>}
          {docs > 0 && (
            <p className="story-card-docs">
              {docs} {docs === 1 ? 'document' : 'documents'} in the collection
            </p>
          )}
          {story._status !== 'published' && <p className="badge badge-draft">Draft</p>}
        </div>
      </Link>
    </li>
  )
}

export function StoryGrid({ stories }: { stories: Story[] }) {
  return (
    <ul className="story-grid" role="list">
      {stories.map((s) => (
        <StoryCard key={s.id} story={s} />
      ))}
    </ul>
  )
}
