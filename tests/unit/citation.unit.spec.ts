import { describe, expect, it } from 'vitest'

import { citations } from '@/lib/citation'

describe('story citations', () => {
  const c = citations({ title: 'Chin-Wu Huang', authors: ['Grace Farrell'], published: '2026-04-30', url: 'https://daaho.lib.miamioh.edu/stories/chin-wu-huang' })

  it('writes Chicago, APA and MLA', () => {
    expect(c.chicago).toBe(
      'Farrell, Grace. “Chin-Wu Huang.” Documenting Asian American Histories in Ohio, Miami University Libraries, April 30, 2026. https://daaho.lib.miamioh.edu/stories/chin-wu-huang.',
    )
    expect(c.apa).toBe('Farrell, G. (2026, April 30). Chin-Wu Huang. Documenting Asian American Histories in Ohio. https://daaho.lib.miamioh.edu/stories/chin-wu-huang')
    expect(c.mla).toBe('Farrell, Grace. “Chin-Wu Huang.” Documenting Asian American Histories in Ohio, Miami University Libraries, 30 Apr. 2026, daaho.lib.miamioh.edu/stories/chin-wu-huang.')
  })

  it('copes with no author or date', () => {
    const n = citations({ title: 'Thai students at Miami', authors: [], published: null, url: 'https://x.test/s' })
    expect(n.chicago).toBe('“Thai students at Miami.” Documenting Asian American Histories in Ohio, Miami University Libraries. https://x.test/s.')
    expect(n.apa).toBe('(n.d.). Thai students at Miami. Documenting Asian American Histories in Ohio. https://x.test/s')
  })
})
