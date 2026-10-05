import type { Metadata } from 'next'

import { EntityIndex } from '@/components/EntityIndex'

export const metadata: Metadata = { title: 'Subjects' }

export default function SubjectsIndexPage() {
  return <EntityIndex kind="subjects" title="Subjects" intro="Subjects assigned to the documents, from the FAST controlled vocabulary." />
}
