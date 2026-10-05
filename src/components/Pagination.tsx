import Link from 'next/link'

export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span aria-hidden="true" />}
      <span>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? <Link href={href(page + 1)}>Next →</Link> : <span aria-hidden="true" />}
    </nav>
  )
}
