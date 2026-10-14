import { describe, expect, it } from 'vitest'

import { formatEventDates, isUpcoming, todayInOhio, validDay } from '@/lib/eventDates'

describe('event dates', () => {
  it('formats single days and ranges', () => {
    expect(formatEventDates('2024-07-20')).toBe('July 20, 2024')
    expect(formatEventDates('2024-07-20', '2024-07-20')).toBe('July 20, 2024')
    expect(formatEventDates('2025-03-13', '2025-03-16')).toBe('March 13–16, 2025')
    expect(formatEventDates('2025-09-30', '2025-10-02')).toBe('September 30 – October 2, 2025')
    expect(formatEventDates('2025-12-30', '2026-01-02')).toBe('December 30, 2025 – January 2, 2026')
  })

  it('rejects impossible dates', () => {
    expect(validDay('2025-02-30')).not.toBe(true)
    expect(validDay('03/13/2025')).not.toBe(true)
    expect(validDay('', true)).not.toBe(true)
    expect(validDay('')).toBe(true)
    expect(validDay('2024-02-29')).toBe(true)
  })

  it('keeps an event upcoming through its last day, in Ohio time', () => {
    expect(isUpcoming({ start: '2025-10-08', end: '2025-10-27' }, '2025-10-27')).toBe(true)
    expect(isUpcoming({ start: '2025-10-08', end: '2025-10-27' }, '2025-10-28')).toBe(false)
    expect(isUpcoming({ start: '2024-07-20' }, '2024-07-20')).toBe(true)
    // 01:30 UTC on 28 Oct is still 27 Oct in Ohio.
    expect(todayInOhio(new Date('2025-10-28T01:30:00Z'))).toBe('2025-10-27')
  })
})
