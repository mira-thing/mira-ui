import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useUtcOffset } from '../useUtcOffset'
import type { ObserverStatus, ObserverStatusInactive } from '@/api/types'

// spreading Partial<ObserverStatus> would widen `active` off its false literal
const idle = (over: Partial<Omit<ObserverStatusInactive, 'active'>> = {}): ObserverStatus => ({
  active: false,
  message: 'no session',
  ...over,
})

describe('useUtcOffset', () => {
  beforeEach(() => window.localStorage.clear())

  const render = (status: ObserverStatus | null) =>
    renderHook(({ s }) => useUtcOffset(s), { initialProps: { s: status } })

  it('knows nothing until the daemon answers', () => {
    expect(render(null).result.current).toBeNull()
    expect(render(idle()).result.current).toBeNull()
  })

  it('takes the offset the daemon reports', () => {
    const { result } = render(idle({ utc_offset_min: -420 }))
    expect(result.current).toBe(-420)
    expect(window.localStorage.getItem('mira.utcOffsetMin')).toBe('-420')
  })

  it('reads back the stored offset so the clock is right before the daemon answers', () => {
    window.localStorage.setItem('mira.utcOffsetMin', '60')
    expect(render(null).result.current).toBe(60)
  })

  it('keeps the last known offset when the daemon stops reporting one', () => {
    const { result, rerender } = render(idle({ utc_offset_min: 60 }))
    rerender({ s: idle() })
    expect(result.current).toBe(60)
  })

  it('follows the daemon across a timezone change', () => {
    const { result, rerender } = render(idle({ utc_offset_min: 60 }))
    rerender({ s: idle({ utc_offset_min: -300 }) })
    expect(result.current).toBe(-300)
    expect(window.localStorage.getItem('mira.utcOffsetMin')).toBe('-300')
  })

  it('handles a zero offset rather than reading it as absent', () => {
    expect(render(idle({ utc_offset_min: 0 })).result.current).toBe(0)
  })
})
