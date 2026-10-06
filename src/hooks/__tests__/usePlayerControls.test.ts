import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePlayerControls } from '../usePlayerControls'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatusActive } from '../../api/types'

function makeMocks() {
  return {
    play: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    pause: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    next: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    prev: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    seek: vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined),
    setShuffle: vi.fn<(on: boolean) => Promise<void>>().mockResolvedValue(undefined),
    setRepeat: vi
      .fn<(mode: 'off' | 'context' | 'track') => Promise<void>>()
      .mockResolvedValue(undefined),
  }
}

const T0 = 1_716_390_000_000

it('does not cancel a newer skip when an older command fails late', async () => {
  const mocks = makeMocks()
  let reject!: (error: Error) => void
  mocks.next.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const { result } = renderHook(() => usePlayerControls({ status: activeStatus, ...mocks }))
    act(() => result.current.onNext())
    act(() => result.current.onPrevTrack())
    const latest = result.current.trackTransition
    await act(async () => reject(new Error('old skip failed')))
    expect(result.current.trackTransition).toBe(latest)
    expect(result.current.transitioning).toBe(true)
  } finally {
    warning.mockRestore()
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePlayerControls optimistic play/pause', () => {
  it('flips isPaused immediately on onPlayPause and fires explicit resume', () => {
    const mocks = makeMocks()
    const status: ObserverStatusActive = {
      ...activeStatus,
      is_paused: true,
      received_at: T0 - 1_000,
    }

    const { result } = renderHook(() => usePlayerControls({ status, ...mocks }))

    expect(result.current.isPaused).toBe(true)

    act(() => {
      result.current.onPlayPause()
    })

    expect(result.current.isPaused).toBe(false)
    expect(mocks.play).toHaveBeenCalledTimes(1)
    expect(mocks.pause).not.toHaveBeenCalled()
  })

  it('sends explicit pause then resume on a fast double tap', () => {
    const mocks = makeMocks()
    const status: ObserverStatusActive = {
      ...activeStatus,
      is_paused: false,
      is_playing: true,
      received_at: T0 - 1_000,
    }

    const { result } = renderHook(() => usePlayerControls({ status, ...mocks }))

    act(() => {
      result.current.onPlayPause()
    })
    expect(result.current.isPaused).toBe(true)
    expect(mocks.pause).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.onPlayPause()
    })
    expect(result.current.isPaused).toBe(false)
    expect(mocks.play).toHaveBeenCalledTimes(1)
  })

  it('holds optimistic pause through stale snapshots until the target is confirmed', () => {
    // A random newer snapshot may still carry old playback state
    const mocks = makeMocks()
    const initial: ObserverStatusActive = {
      ...activeStatus,
      is_paused: true,
      received_at: T0 - 1_000,
    }
    const { result, rerender } = renderHook(
      ({ status }: { status: ObserverStatusActive }) => usePlayerControls({ status, ...mocks }),
      { initialProps: { status: initial } },
    )

    act(() => {
      result.current.onPlayPause()
    })
    expect(result.current.isPaused).toBe(false)

    // stale snapshot still reporting paused=true
    rerender({ status: { ...initial, is_paused: true, received_at: T0 + 100 } })
    expect(result.current.isPaused).toBe(false)

    // server confirms the target
    rerender({ status: { ...initial, is_paused: false, received_at: T0 + 200 } })
    expect(result.current.isPaused).toBe(false)
  })

  it('clears the optimistic pause and reports an error when the command fails', async () => {
    const mocks = makeMocks()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const onCommandError = vi.fn()
    mocks.play.mockRejectedValueOnce(new Error('offline'))
    const status: ObserverStatusActive = {
      ...activeStatus,
      is_paused: true,
      received_at: T0 - 1_000,
    }

    try {
      const { result } = renderHook(() => usePlayerControls({ status, ...mocks, onCommandError }))

      await act(async () => {
        result.current.onPlayPause()
        await Promise.resolve()
      })

      expect(result.current.isPaused).toBe(true)
      expect(onCommandError).toHaveBeenCalledWith('Play/pause failed')
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('usePlayerControls prev double-tap window', () => {
  it('rewinds to 0 on the first prev press without firing the prev command', () => {
    const mocks = makeMocks()
    const { result } = renderHook(() => usePlayerControls({ status: activeStatus, ...mocks }))

    act(() => {
      result.current.onPrev()
    })

    expect(mocks.seek).toHaveBeenCalledTimes(1)
    expect(mocks.seek).toHaveBeenCalledWith(0)
    expect(mocks.prev).not.toHaveBeenCalled()
  })

  it('fires the actual prev command on a second press within 1500ms', () => {
    const mocks = makeMocks()
    const { result } = renderHook(() => usePlayerControls({ status: activeStatus, ...mocks }))

    act(() => {
      result.current.onPrev()
    })
    expect(mocks.seek).toHaveBeenCalledTimes(1)

    vi.setSystemTime(T0 + 500)

    act(() => {
      result.current.onPrev()
    })

    expect(mocks.seek).toHaveBeenCalledTimes(1)
    expect(mocks.prev).toHaveBeenCalledTimes(1)
  })

  it('rewinds again (not skip) on a second press past the 1500ms window', () => {
    // off-by-one would demote rewinds to skips at exactly 1500ms
    const mocks = makeMocks()
    const { result } = renderHook(() => usePlayerControls({ status: activeStatus, ...mocks }))

    act(() => {
      result.current.onPrev()
    })

    vi.setSystemTime(T0 + 1_500)

    act(() => {
      result.current.onPrev()
    })

    expect(mocks.seek).toHaveBeenCalledTimes(2)
    expect(mocks.seek).toHaveBeenNthCalledWith(1, 0)
    expect(mocks.seek).toHaveBeenNthCalledWith(2, 0)
    expect(mocks.prev).not.toHaveBeenCalled()
  })
})

describe('usePlayerControls repeat / shuffle cycling', () => {
  it('cycles repeat through off > context > track > off and fires setRepeat each step', () => {
    const mocks = makeMocks()
    const status: ObserverStatusActive = {
      ...activeStatus,
      repeat_context: false,
      repeat_track: false,
      received_at: T0 - 1_000,
    }
    const { result } = renderHook(() => usePlayerControls({ status, ...mocks }))

    expect(result.current.repeat).toBe('off')

    act(() => {
      result.current.onCycleRepeat()
    })
    expect(result.current.repeat).toBe('context')
    expect(mocks.setRepeat).toHaveBeenNthCalledWith(1, 'context')

    act(() => {
      result.current.onCycleRepeat()
    })
    expect(result.current.repeat).toBe('track')
    expect(mocks.setRepeat).toHaveBeenNthCalledWith(2, 'track')

    act(() => {
      result.current.onCycleRepeat()
    })
    expect(result.current.repeat).toBe('off')
    expect(mocks.setRepeat).toHaveBeenNthCalledWith(3, 'off')
  })

  it('holds optimistic shuffle through a stale status, then follows the confirmed value', () => {
    // regression for the flash: a stale in-flight status (still the old value)
    // must NOT drop the optimistic before the server reports the target
    const mocks = makeMocks()
    const initial: ObserverStatusActive = {
      ...activeStatus,
      shuffle: false,
      received_at: T0 - 1_000,
    }
    const { result, rerender } = renderHook(
      ({ status }: { status: ObserverStatusActive }) => usePlayerControls({ status, ...mocks }),
      { initialProps: { status: initial } },
    )

    act(() => {
      result.current.onToggleShuffle()
    })
    expect(result.current.shuffle).toBe(true)

    // stale status still reporting false
    rerender({ status: { ...initial, shuffle: false, received_at: T0 + 100 } })
    expect(result.current.shuffle).toBe(true)

    // server confirms the target
    rerender({ status: { ...initial, shuffle: true, received_at: T0 + 200 } })
    expect(result.current.shuffle).toBe(true)
  })

  it('clears a never-confirmed optimistic shuffle after the safety timeout', () => {
    const mocks = makeMocks()
    const initial: ObserverStatusActive = {
      ...activeStatus,
      shuffle: false,
      received_at: T0 - 1_000,
    }
    const { result } = renderHook(
      ({ status }: { status: ObserverStatusActive }) => usePlayerControls({ status, ...mocks }),
      { initialProps: { status: initial } },
    )

    act(() => {
      result.current.onToggleShuffle()
    })
    expect(result.current.shuffle).toBe(true)

    // change never confirms
    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(result.current.shuffle).toBe(false)
  })

  it('holds optimistic repeat through a stale status, then follows the confirmed value', () => {
    const mocks = makeMocks()
    const initial: ObserverStatusActive = {
      ...activeStatus,
      repeat_context: false,
      repeat_track: false,
      received_at: T0 - 1_000,
    }
    const { result, rerender } = renderHook(
      ({ status }: { status: ObserverStatusActive }) => usePlayerControls({ status, ...mocks }),
      { initialProps: { status: initial } },
    )

    act(() => {
      result.current.onCycleRepeat()
    })
    expect(result.current.repeat).toBe('context')

    // stale status still reporting off
    rerender({
      status: { ...initial, repeat_context: false, repeat_track: false, received_at: T0 + 100 },
    })
    expect(result.current.repeat).toBe('context')

    // server confirms context
    rerender({
      status: { ...initial, repeat_context: true, repeat_track: false, received_at: T0 + 200 },
    })
    expect(result.current.repeat).toBe('context')
  })

  it('clears a never-confirmed optimistic repeat after the safety timeout', () => {
    const mocks = makeMocks()
    const initial: ObserverStatusActive = {
      ...activeStatus,
      repeat_context: false,
      repeat_track: false,
      received_at: T0 - 1_000,
    }
    const { result } = renderHook(
      ({ status }: { status: ObserverStatusActive }) => usePlayerControls({ status, ...mocks }),
      { initialProps: { status: initial } },
    )

    act(() => {
      result.current.onCycleRepeat()
    })
    expect(result.current.repeat).toBe('context')

    act(() => {
      vi.advanceTimersByTime(3_000)
    })
    expect(result.current.repeat).toBe('off')
  })
})

describe('usePlayerControls track-transition dim', () => {
  it('orders rapid mixed skips and keeps feedback pending through intermediate tracks', async () => {
    const mocks = makeMocks()
    let acknowledge!: () => void
    mocks.next.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve
        }),
    )
    const { result, rerender } = renderHook(
      ({ status }) => usePlayerControls({ status, ...mocks }),
      {
        initialProps: { status: activeStatus },
      },
    )
    act(() => result.current.onNext())
    const first = result.current.trackTransition
    act(() => result.current.onNext())
    expect(result.current.trackTransition).not.toBe(first)
    act(() => result.current.onPrevTrack())
    expect(mocks.next).toHaveBeenCalledTimes(1)
    expect(mocks.prev).not.toHaveBeenCalled()
    rerender({ status: { ...activeStatus, track_id: 'b' } })
    expect(result.current.transitioning).toBe(true)
    expect(mocks.next).toHaveBeenCalledTimes(1) // and waits for the http ack
    await act(async () => acknowledge())
    expect(mocks.next).toHaveBeenCalledTimes(2)
    expect(mocks.prev).not.toHaveBeenCalled()
    await act(async () => rerender({ status: { ...activeStatus, track_id: 'c' } }))
    expect(mocks.prev).toHaveBeenCalledTimes(1)
    expect(result.current.transitioning).toBe(true)
    await act(async () => rerender({ status: { ...activeStatus, track_id: 'b' } }))
    expect(result.current.transitioning).toBe(false)
    expect(result.current.trackTransition).toBeNull()
  })

  it('marks transitioning during a next click and clears when the track id changes', () => {
    const mocks = makeMocks()
    const initial: ObserverStatusActive = {
      ...activeStatus,
      received_at: T0 - 1_000,
    }
    const { result, rerender } = renderHook(
      ({ status }: { status: ObserverStatusActive }) => usePlayerControls({ status, ...mocks }),
      { initialProps: { status: initial } },
    )

    expect(result.current.transitioning).toBe(false)

    act(() => {
      result.current.onNext()
    })
    expect(result.current.transitioning).toBe(true)
    expect(mocks.next).toHaveBeenCalledTimes(1)

    // unrelated newer snapshot for the same track should not clear the dim
    rerender({ status: { ...initial, received_at: T0 + 100 } })
    expect(result.current.transitioning).toBe(true)

    rerender({ status: { ...initial, track_id: 'next-track', received_at: T0 + 200 } })
    expect(result.current.transitioning).toBe(false)
  })

  it('does NOT mark transitioning on a first prev press (rewind, not track change)', () => {
    const mocks = makeMocks()
    const { result } = renderHook(() => usePlayerControls({ status: activeStatus, ...mocks }))

    act(() => {
      result.current.onPrev()
    })

    expect(result.current.transitioning).toBe(false)
  })
})
