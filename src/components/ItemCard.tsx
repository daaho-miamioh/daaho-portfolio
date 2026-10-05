import Link from 'next/link'

import { displayDate } from '@/lib/dates'
import { asMedia, src } from '@/lib/media'
import type { Item } from '@/payload-types'

export function ItemCard({ item, note }: { item: Item; note?: string }) {
  const cover = asMedia(item.pages?.[0]?.image)
  return (
    <li className="card">
      <Link href={`/items/${item.slug}`} className="card-link">
        <div className="card-image">
          {cover ? (
            // Decorative here: the title below names the item, and the item page carries full alt text.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(cover, 'card')} alt="" width={400} height={500} loading="lazy" />
          ) : (
            <span className="card-noimage" aria-hidden="true" />
          )}
        </div>
        <div className="card-body">
          <h3 className="card-title">{item.title}</h3>
          <p className="card-meta">
            {displayDate(item.date)}
            {item.pages && item.pages.length > 1 ? ` · ${item.pages.length} pages` : ''}
          </p>
          {note && <p className="card-note">{note}</p>}
          {item._status !== 'published' && <p className="badge badge-draft">Draft</p>}
        </div>
      </Link>
    </li>
  )
}

export function ItemGrid({ items, notes }: { items: Item[]; notes?: Map<number, string> }) {
  if (!items.length) return <p className="empty">No items to show yet.</p>
  return (
    <ul className="grid" role="list">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} note={notes?.get(item.id)} />
      ))}
    </ul>
  )
}
