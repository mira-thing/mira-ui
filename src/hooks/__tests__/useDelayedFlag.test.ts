import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDelayedFlag } from '../useDelayedFlag'

describe('useDelayedFlag', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  it('flips once the wait elapses', () => {
    const { result } = renderHook(() => useDelayedFlag(true, 1000))
    expect(result.current).toBe(false)
    advance(999)
    expect(result.current).toBe(false)
    advance(1)
    expect(result.current).toBe(true)
  })

  it('stays false while inactive', () => {
    const { result } = renderHook(() => useDelayedFlag(false, 1000))
    advance(5000)
    expect(result.current).toBe(false)
  })

  it('drops back to false as soon as the condition clears', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
      initialProps: { active: true },
    })
    advance(1000)
    expect(result.current).toBe(true)
    rerender({ active: false })
    expect(result.current).toBe(false)
  })

  it('re-arms the full wait when the condition returns', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 1000), {
      initialProps: { active: true },
    })
    advance(1000)
    rerender({ active: false })
    rerender({ active: true })
    expect(result.current).toBe(false) // not still true from the first wait
    advance(999)
    expect(result.current).toBe(false)
    advance(1)
    expect(result.current).toBe(true)
  })

  it('restarts the wait when the reset key changes', () => {
    const { result, rerender } = renderHook(({ key }) => useDelayedFlag(true, 1000, key), {
      initialProps: { key: 'a' },
    })
    advance(900)
    rerender({ key: 'b' })
    advance(900)
    expect(result.current).toBe(false) // the first 900ms does not carry over
    advance(100)
    expect(result.current).toBe(true)
  })

  it('does not restart on a rerender that changes nothing', () => {
    const { result, rerender } = renderHook(({ key }) => useDelayedFlag(true, 1000, key), {
      initialProps: { key: 'a' },
    })
    advance(900)
    rerender({ key: 'a' })
    advance(100)
    expect(result.current).toBe(true)
  })
})
