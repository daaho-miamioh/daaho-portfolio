import type { Metadata } from 'next'

import { EntityPage, loadEntity } from '@/components/EntityPage'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const entity = await loadEntity('subjects', (await params).slug)
  return entity ? { title: entity.name } : {}
}

export default async function SubjectsPage({ params }: Params) {
  return <EntityPage kind="subjects" slug={(await params).slug} />
}
