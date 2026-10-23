import { describe, expect, it } from 'vitest'

import { markdownToLexical } from '@/lib/markdownToLexical'

const paras = (md: string) => markdownToLexical(md).root.children

describe('markdownToLexical', () => {
  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    const p = paras('First line\ncontinues.\n\nSecond.')
    expect(p).toHaveLength(2)
    expect(p[0].children[0]).toMatchObject({ type: 'text', text: 'First line continues.' })
  })

  it('reads *italic* and **bold**', () => {
    const [p] = paras('Miami University. *Recensio*. **Note**.')
    expect(p.children.map((c) => ('text' in c ? [c.text, c.format] : c.type))).toEqual([
      ['Miami University. ', 0],
      ['Recensio', 2],
      ['. ', 0],
      ['Note', 1],
      ['.', 0],
    ])
  })

  it('keeps a URL with underscores whole, as a link, without the full stop after it', () => {
    const url = 'https://search.ancestry.com/cgi-bin/sse.dll?queryId=5cae&_phsrc=nYK949&_phstart=successSource'
    const [p] = paras(`*Ancestry*. ${url}.`)
    const link = p.children.find((c) => c.type === 'link')
    expect(link).toMatchObject({ type: 'link', fields: { url, newTab: true } })
    expect(p.children.at(-1)).toMatchObject({ type: 'text', text: '.' })
    expect(p.children.some((c) => c.type === 'text' && c.format === 2 && c.text === 'Ancestry')).toBe(true)
  })

  it('links item IDs that exist on the site, and leaves others as text', () => {
    const refs = new Map([['AAMU-0061', '/items/aamu-0061']])
    const [p] = markdownToLexical('Special Collections. AAMU-0061, 1, 2. Also AAMU-9999.', refs).root.children
    const link = p.children.find((c) => c.type === 'link')
    expect(link).toMatchObject({ fields: { url: '/items/aamu-0061', newTab: false }, children: [{ text: 'AAMU-0061' }] })
    expect(p.children.filter((c) => c.type === 'link')).toHaveLength(1)
  })
})
