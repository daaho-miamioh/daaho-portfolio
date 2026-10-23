import { describe, expect, it } from 'vitest'

import { parseCsv } from '@/lib/csv'

describe('parseCsv', () => {
  it('reads quoted fields with commas, doubled quotes and line breaks', () => {
    const rows = parseCsv('﻿Identifier,Title,Date\r\nAAMU-0001,"Letter, with ""quotes""\nand a break",1977-04-26\r\n')
    expect(rows).toEqual([{ Identifier: 'AAMU-0001', Title: 'Letter, with "quotes"\nand a break', Date: '1977-04-26' }])
  })

  it('keeps the first of two columns with the same header, and skips empty rows', () => {
    const rows = parseCsv('Identifier,Title,Identifier\nAAMU-0002,A,ignored\n,,\n')
    expect(rows).toEqual([{ Identifier: 'AAMU-0002', Title: 'A' }])
  })

  it('handles a last line with no line break', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([{ a: '1', b: '2' }])
  })
})
