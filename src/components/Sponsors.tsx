import { asMedia, src } from '@/lib/media'
import type { Home } from '@/payload-types'

/** The funders' logos (or names), from the Home page settings. */
export function Sponsors({ sponsors }: { sponsors: Home['sponsors'] }) {
  const list = (sponsors ?? []).map((s) => ({ ...s, logo: asMedia(s.logo) }))
  if (!list.length) return null
  return (
    <section aria-labelledby="sponsors-heading" className="sponsors">
      <p id="sponsors-heading" className="eyebrow">
        Supported by
      </p>
      <ul role="list">
        {list.map((s) => {
          const content = s.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(s.logo, 'card')} alt={s.name} loading="lazy" />
          ) : (
            s.name
          )
          return <li key={s.id ?? s.name}>{s.url ? <a href={s.url}>{content}</a> : content}</li>
        })}
      </ul>
    </section>
  )
}
