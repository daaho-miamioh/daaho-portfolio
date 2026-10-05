import Link from 'next/link'

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        This page does not exist, or the item has not been published yet. <Link href="/items">Browse all items</Link>.
      </p>
    </>
  )
}
