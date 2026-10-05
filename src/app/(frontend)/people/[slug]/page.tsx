import type { Metadata } from 'next'

import { EntityPage, loadEntity } from '@/components/EntityPage'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const entity = await loadEntity('people', (await params).slug)
  return entity ? { title: entity.name } : {}
}

export default async function PeoplePage({ params }: Params) {
  return <EntityPage kind="people" slug={(await params).slug} />
}
