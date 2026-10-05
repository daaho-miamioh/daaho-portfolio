import type { Metadata } from 'next'

import { EntityIndex } from '@/components/EntityIndex'

export const metadata: Metadata = { title: 'Places' }

export default function PlacesIndexPage() {
  return <EntityIndex kind="places" title="Places" intro="Where the documents were written, as Library of Congress FAST headings." />
}
