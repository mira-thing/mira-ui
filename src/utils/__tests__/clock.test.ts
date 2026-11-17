import { describe, expect, it } from 'vitest'
import { clockParts, dateLabel, displayNow, msToNextMinute } from '../clock'

describe('clockParts', () => {
  it('reads as a 12-hour clock with no leading zero on the hour', () => {
    expect(clockParts(new Date(2026, 10, 14, 0, 5))).toEqual({ time: '12:05', ampm: 'AM' })
    expect(clockParts(new Date(2026, 10, 14, 9, 30))).toEqual({ time: '9:30', ampm: 'AM' })
    expect(clockParts(new Date(2026, 10, 14, 12, 0))).toEqual({ time: '12:00', ampm: 'PM' })
    expect(clockParts(new Date(2026, 10, 14, 23, 59))).toEqual({ time: '11:59', ampm: 'PM' })
  })
})

describe('dateLabel', () => {
  it('spells the day and month without locale data', () => {
    expect(dateLabel(new Date(2026, 10, 14))).toBe('Sat, Nov 14')
  })
})

describe('displayNow', () => {
  const at = Date.UTC(2026, 10, 14, 12, 0)

  it('shifts to the daemon’s offset when it has one', () => {
    const d = displayNow(-300, at)
    expect([d.getHours(), d.getMinutes()]).toEqual([7, 0])
  })

  it('keeps the browser’s zone when the offset is unknown', () => {
    expect(displayNow(null, at).getTime()).toBe(at)
  })
})

describe('msToNextMinute', () => {
  it('counts to the next whole minute', () => {
    expect(msToNextMinute(Date.UTC(2026, 10, 14, 12, 0, 59, 500))).toBe(500)
    expect(msToNextMinute(Date.UTC(2026, 10, 14, 12, 0, 0))).toBe(60_000)
  })
})
