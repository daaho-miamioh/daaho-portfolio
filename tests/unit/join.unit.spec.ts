import { describe, expect, it } from 'vitest'

import { checkApplication } from '@/lib/accessRequests'
import { MAX_BATCH, parseInviteList } from '@/lib/inviteList'

describe('parseInviteList', () => {
  it('reads a name and address in the shapes people paste', () => {
    const rows = parseInviteList(
      ['Ann Lee, ann@miamioh.edu', 'Bo Chen <CHENB@miamioh.edu>', '"Cara O\'Neil" <cara@x.org>', 'dan@x.org (Dan Wu)', 'eve@x.org, Eve Park', 'Lee, Fay - fay@x.org'].join('\n'),
    )
    expect(rows.map((r) => [r.name, r.email, r.problem])).toEqual([
      ['Ann Lee', 'ann@miamioh.edu', undefined],
      ['Bo Chen', 'chenb@miamioh.edu', undefined],
      ["Cara O'Neil", 'cara@x.org', undefined],
      ['Dan Wu', 'dan@x.org', undefined],
      ['Eve Park', 'eve@x.org', undefined],
      ['Lee, Fay', 'fay@x.org', undefined],
    ])
  })

  it('reads spreadsheet rows, skipping the heading and any later columns', () => {
    const rows = parseInviteList('Name\tEmail\tRole\nAnn Lee\tann@x.edu\tStudent\nbo@x.edu\tBo Chen')
    expect(rows.map((r) => [r.line, r.name, r.email])).toEqual([
      [2, 'Ann Lee', 'ann@x.edu'],
      [3, 'Bo Chen', 'bo@x.edu'],
    ])
  })

  it('says what is wrong with a line instead of dropping it', () => {
    const rows = parseInviteList('Ann Lee\nann@x.edu\nBo Chen bo@x.edu cy@x.edu\nCara, CARA@x.edu\nCara again, cara@x.edu\n\n')
    expect(rows.map((r) => r.problem)).toEqual([
      'No email address on this line.',
      'Add their name; the invitation greets them by it.',
      'Put one person on each line.',
      undefined,
      'Listed twice; the first is used.',
    ])
  })

  it(`stops at ${MAX_BATCH} people`, () => {
    const text = Array.from({ length: MAX_BATCH + 2 }, (_, i) => `Person ${i}, p${i}@x.edu`).join('\n')
    const rows = parseInviteList(text)
    expect(rows.filter((r) => !r.problem)).toHaveLength(MAX_BATCH)
    expect(rows.at(-1)?.problem).toMatch(/another batch/)
  })
})

describe('checkApplication', () => {
  it('tidies a complete request', () => {
    const { data, errors } = checkApplication({ name: '  Ann   Lee ', email: ' Ann@X.edu ', affiliation: '', kind: 'student', reason: ' Review letters ' })
    expect(errors).toEqual({})
    expect(data).toEqual({ name: 'Ann Lee', email: 'ann@x.edu', affiliation: '', kind: 'student', reason: 'Review letters' })
  })

  it('names every missing or invalid answer', () => {
    const { errors } = checkApplication({ name: '', email: 'ann@', kind: 'owner', reason: '', affiliation: 'x'.repeat(201) })
    expect(Object.keys(errors).sort()).toEqual(['affiliation', 'email', 'kind', 'name', 'reason'])
  })
})
