import { Pill } from '@payloadcms/ui'
import type { DefaultServerCellComponentProps } from 'payload'

/**
 * Cells for the Annotations list, so staff can tell at a glance who wrote each note: a visitor's
 * suggestion carries a colored tag under Source, and under Author it names the visitor rather than
 * showing "<No Author>". Server components: the list renders them with the row's full record.
 */

export function SourceCell({ cellData }: DefaultServerCellComponentProps) {
  if (cellData === 'public') {
    return (
      <Pill pillStyle="warning" size="small">
        Public suggestion
      </Pill>
    )
  }
  return <span>Project staff</span>
}

const faint = { color: 'var(--theme-elevation-500)' }

export async function AuthorCell({ cellData, rowData, payload }: DefaultServerCellComponentProps) {
  if (rowData?.source === 'public') {
    const name = typeof rowData.submitterName === 'string' ? rowData.submitterName.trim() : ''
    return (
      <span>
        Visitor{name ? ': ' : ''}
        {name || <span style={faint}> (no name given)</span>}
      </span>
    )
  }
  if (cellData && typeof cellData === 'object') return <span>{(cellData as { name?: string }).name ?? '—'}</span>
  if (cellData === null || cellData === undefined || cellData === '') return <span style={faint}>—</span>
  const user = await payload
    .findByID({ collection: 'users', id: cellData as number | string, depth: 0 })
    .catch(() => null)
  return <span>{user?.name || <span style={faint}>(account removed)</span>}</span>
}
