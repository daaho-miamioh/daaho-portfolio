import type { Metadata } from 'next'

import { EntityIndex } from '@/components/EntityIndex'

export const metadata: Metadata = { title: 'People' }

export default function PeopleIndexPage() {
  return <EntityIndex kind="people" title="People" intro="People and organizations named in the collection, from writers and recipients to those mentioned in passing." />
}
