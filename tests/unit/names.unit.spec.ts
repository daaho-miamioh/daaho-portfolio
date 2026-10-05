import { describe, expect, it } from 'vitest'

import { cleanName, clusters, invert, mayBeSamePerson, nameKey, splitJoined } from '@/lib/names'

// Every case below is a real string from the 128-record pipeline batch.

describe('invert', () => {
  it('reorders unambiguous personal names', () => {
    expect(invert('Alfred H. Upham')).toBe('Upham, Alfred H.')
    expect(invert('C. H. Conmy')).toBe('Conmy, C. H.')
    expect(invert('Kiyoshi Tomizawa')).toBe('Tomizawa, Kiyoshi')
  })

  it('leaves alone anything reordering would corrupt', () => {
    expect(invert('Rama V')).toBe('Rama V') // regnal name, not "V, Rama"
    expect(invert('Rama VI')).toBe('Rama VI')
    expect(invert('Miss Hamilton')).toBe('Miss Hamilton')
    expect(invert('Royal Thai Legation')).toBe('Royal Thai Legation')
    expect(invert('Department of State')).toBe('Department of State')
    expect(invert('Shideler')).toBe('Shideler')
    expect(invert('Upham, Alfred H.')).toBe('Upham, Alfred H.')
  })
})

describe('nameKey merges only provably identical names', () => {
  it('ignores punctuation, spacing and name order', () => {
    expect(nameKey('Upham, A.H.')).toBe(nameKey('Upham, A. H.'))
    expect(nameKey('Alfred H. Upham')).toBe(nameKey('Upham, Alfred H.'))
    expect(nameKey('R. M. Hughes')).toBe(nameKey('Hughes, R. M.'))
  })

  it('does not merge an initial with a full given name', () => {
    expect(nameKey('Upham, A. H.')).not.toBe(nameKey('Upham, Alfred H.'))
  })

  it('does not merge an honorific form with a bare surname', () => {
    expect(nameKey('Miss Hamilton')).not.toBe(nameKey('Hamilton'))
  })
})

describe('mayBeSamePerson proposes candidates for human review', () => {
  it('flags initials against full names', () => {
    expect(mayBeSamePerson(nameKey('Upham, A. H.'), nameKey('Upham, Alfred H.'))).toBe(true)
    expect(mayBeSamePerson(nameKey('Chang, H. H.'), nameKey('Chang, Hsinchin A.'))).toBe(true)
  })

  it('flags one-letter surname variants', () => {
    expect(mayBeSamePerson(nameKey('Shideler'), nameKey('Shidler'))).toBe(true)
    expect(mayBeSamePerson(nameKey('Shriver, Philip R.'), nameKey('Shriver, Phillip R.'))).toBe(true)
  })

  it('flags a bare surname against a full name', () => {
    expect(mayBeSamePerson(nameKey('Upham'), nameKey('Upham, Alfred H.'))).toBe(true)
    expect(mayBeSamePerson(nameKey('Miss Marshall'), nameKey('Marshall'))).toBe(true)
  })

  it('does not flag different given initials or different surnames', () => {
    expect(mayBeSamePerson(nameKey('Wilson, Charles R.'), nameKey('Wilson, Woodrow'))).toBe(false)
    expect(mayBeSamePerson(nameKey('Huang, Chin-Wu'), nameKey('Hughes, R. M.'))).toBe(false)
  })

  it('does not fuzzy-match a lone first name against a surname', () => {
    expect(mayBeSamePerson(nameKey('Berry, Eddye'), nameKey('Jerry'))).toBe(false)
  })

  it('never pairs a name with itself', () => {
    expect(mayBeSamePerson(nameKey('Upham, A.H.'), nameKey('Upham, A. H.'))).toBe(false)
  })
})

describe('splitJoined undoes names emitted as one quote-joined string', () => {
  it('splits backtick-joined names (AAMU-0003)', () => {
    expect(splitJoined('Dockery, F. Jean`,`Ellis, Gloria B.`')).toEqual(['Dockery, F. Jean', 'Ellis, Gloria B.'])
  })

  it("splits single-quote-joined names (AAMU-0058)", () => {
    expect(splitJoined("Rifat, Fereed','Wang, Sadie','Wang, Helen','Chalufour-Bishop, Marguerite")).toEqual([
      'Rifat, Fereed',
      'Wang, Sadie',
      'Wang, Helen',
      'Chalufour-Bishop, Marguerite',
    ])
  })

  it('leaves an ordinary name untouched', () => {
    expect(splitJoined('Upham, Alfred H.')).toEqual(['Upham, Alfred H.'])
  })
})

describe('cleanName', () => {
  it('rejects model reasoning that leaked into the field (AAMU-0003)', () => {
    const r = cleanName('Iso, J. Yun H. T., I. S. O.? No. Need exact. Wait.')
    expect(r.ok).toBe(false)
  })

  it('rejects strings that may be several people rather than guessing a split', () => {
    expect(cleanName('Brooks, Ronald, Burton, Kay').ok).toBe(false)
    expect(cleanName('Runyon, Louisa Runyon Shera, [unclear]').ok).toBe(false)
  })

  it('keeps an uncertain reading but marks it uncertain', () => {
    const r = cleanName('Boateng, Agyenim [unclear]')
    expect(r).toMatchObject({ ok: true, display: 'Boateng, Agyenim', uncertain: true })
    expect(cleanName('Bendbow, Sodienyehyeh?')).toMatchObject({ ok: true, uncertain: true })
  })

  it('classifies organizations and groups', () => {
    expect(cleanName('Royal Thai Legation')).toMatchObject({ ok: true, kind: 'organization' })
    expect(cleanName('Y. M. C. A.')).toMatchObject({ ok: true, kind: 'organization' })
    expect(cleanName('Leland Stanford Junior University')).toMatchObject({ ok: true, kind: 'organization' })
    expect(cleanName('Faculty members')).toMatchObject({ ok: true, kind: 'group' })
    expect(cleanName('Upham, Alfred H.')).toMatchObject({ ok: true, kind: 'person' })
  })

  it('drops a parenthetical that restates the name but keeps a nickname', () => {
    expect(cleanName('Lindegren, Alina M. (Alina M. Lindegren)')).toMatchObject({ display: 'Lindegren, Alina M.' })
    expect(cleanName('Davis, Willis (Bing)')).toMatchObject({ display: 'Davis, Willis (Bing)' })
  })
})

describe('clusters', () => {
  it('turns pairwise candidates into one decision per cluster', () => {
    const pairs = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['a', 'c'])],
      ['c', new Set(['b'])],
      ['x', new Set(['y'])],
      ['y', new Set(['x'])],
    ])
    expect(clusters(pairs)).toEqual([['a', 'b', 'c'], ['x', 'y']])
  })
})
