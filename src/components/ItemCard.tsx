import Link from 'next/link'

import { FORMATS } from '@/collections/Items'
import { displayDate } from '@/lib/dates'
import { asMedia, src } from '@/lib/media'
import { setName } from '@/lib/sets'
import type { Item } from '@/payload-types'

const formatLabel: Record<string, string> = Object.fromEntries(FORMATS.map((f) => [f.value, f.label]))

export function ItemCard({ item, note, showSet = true }: { item: Item; note?: string; showSet?: boolean }) {
  const cover = asMedia(item.pages?.[0]?.image)
  // Its collection's colour and name, so a list mixing collections shows which each item is from.
  const set = showSet && typeof item.set === 'object' && item.set ? item.set : null
  // "Document" is most of the collection and goes without saying; other formats are named.
  const format = item.format && item.format !== 'document' ? formatLabel[item.format] : null
  return (
    <li className={set ? `card has-set set-${set.color ?? 'slate'}` : 'card'}>
      <Link href={`/items/${item.slug}`} className="card-link">
        <div className="card-image">
          {cover ? (
            // Decorative here: the title below names the item, and the item page carries full alt text.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(cover, 'card')} alt="" width={400} height={500} loading="lazy" />
          ) : (
            <span className="card-noimage" aria-hidden="true">
              {format}
            </span>
          )}
        </div>
        <div className="card-body">
          {set && <p className="card-set">{setName(set)}</p>}
          <h3 className="card-title">{item.title}</h3>
          <p className="card-meta">
            {[
              format,
              // A date nobody has checked is not shown at all, rather than as "Undated".
              item.date || item.review?.titleChecked ? displayDate(item.date) : null,
              item.pages && item.pages.length > 1 ? `${item.pages.length} pages` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {note && <p className="card-note">{note}</p>}
          {item._status !== 'published' && <p className="badge badge-draft">Draft</p>}
        </div>
      </Link>
    </li>
  )
}

/** `showSet={false}` on a collection's own page, where every item is from it. */
export function ItemGrid({ items, notes, showSet = true }: { items: Item[]; notes?: Map<number, string>; showSet?: boolean }) {
  if (!items.length) return <p className="empty">No items to show yet.</p>
  return (
    <ul className="grid" role="list">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} note={notes?.get(item.id)} showSet={showSet} />
      ))}
    </ul>
  )
}
