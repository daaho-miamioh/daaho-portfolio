'use client'

import { useConfig, useField, useFormFields } from '@payloadcms/ui'
import Link from 'next/link'
import type { JSONFieldClientComponent } from 'payload'

import type { Changes as ChangeList, Shown } from '@/lib/activity'

/** On a log entry: a link to the record it is about, unless the record is gone. */
export function RecordLink() {
  const { config } = useConfig()
  const type = useFormFields(([fields]) => fields.recordType?.value as string | null | undefined)
  const id = useFormFields(([fields]) => fields.recordId?.value as string | null | undefined)
  const action = useFormFields(([fields]) => fields.action?.value as string | undefined)

  const admin = config.routes.admin
  const href = config.globals.some((g) => g.slug === type)
    ? `${admin}/globals/${type}`
    : id && config.collections.some((c) => c.slug === type)
      ? `${admin}/collections/${type}/${id}`
      : null
  if (!href || action === 'delete') return null
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <Link href={href} className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }}>
        Open the record
      </Link>
    </div>
  )
}

const cell = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--theme-elevation-150)', textAlign: 'left', verticalAlign: 'top' } as const

const show = (v: Shown) =>
  v === null ? <span style={{ color: 'var(--theme-elevation-500)' }}>(empty)</span> : String(v)

/** On a log entry: what changed, field by field, before and after. */
export const Changes: JSONFieldClientComponent = ({ path }) => {
  const { value } = useField<ChangeList | null>({ path })
  const rows = Object.entries(value ?? {})
  if (!rows.length) return null
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        <caption style={{ textAlign: 'left', fontWeight: 600, marginBottom: '0.5rem' }}>What changed</caption>
        <thead>
          <tr>
            <th scope="col" style={{ ...cell, width: '22%' }}>Field</th>
            <th scope="col" style={cell}>Before</th>
            <th scope="col" style={cell}>After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, change]) => (
            <tr key={field}>
              <th scope="row" style={{ ...cell, fontWeight: 400 }}>
                <code>{field}</code>
              </th>
              <td style={cell}>{show(change.from)}</td>
              <td style={cell}>{show(change.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
