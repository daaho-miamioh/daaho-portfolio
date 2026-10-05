import type { Metadata } from 'next'

import { ItemGrid } from '@/components/ItemCard'
import { Pagination } from '@/components/Pagination'
import { getViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Items' }

const PER_PAGE = 24

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const { payload, draft, access } = await getViewer()
  const res = await payload.find({ collection: 'items', sort: 'dateSort', limit: PER_PAGE, page, depth: 1, draft, ...access })

  return (
    <>
      <h1>Items</h1>
      <p className="lede">
        {res.totalDocs} items, earliest first. Each brings together every page of one archival document.
      </p>
      <ItemGrid items={res.docs} />
      <Pagination page={res.page ?? 1} totalPages={res.totalPages} base="/items" />
    </>
  )
}
