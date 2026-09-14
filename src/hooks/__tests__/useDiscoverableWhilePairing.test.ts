import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useDiscoverableWhilePairing,
  type UseDiscoverableWhilePairingParams,
} from '../useDiscoverableWhilePairing'

describe('useDiscoverableWhilePairing', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  function params(
    over: Partial<UseDiscoverableWhilePairingParams> = {},
  ): UseDiscoverableWhilePairingParams {
    return {
      pairingScreenShown: false,
      btMenuOpen: false,
      setDiscoverable: vi.fn().mockResolvedValue(undefined),
      ...over,
    }
  }

  it('turns discoverability off when no pairing screen is up', () => {
    const setDiscoverable = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useDiscoverableWhilePairing(params({ setDiscoverable })))
    expect(setDiscoverable).toHaveBeenCalledWith(false)
  })

  it('turns it on straight away for a pairing screen', () => {
    const setDiscoverable = vi.fn().mockResolvedValue(undefined)
    renderHook(() =>
      useDiscoverableWhilePairing(params({ pairingScreenShown: true, setDiscoverable })),
    )
    expect(setDiscoverable).toHaveBeenCalledWith(true)
  })

  it('keeps re-asserting it, because the adapter times it out', () => {
    const setDiscoverable = vi.fn().mockResolvedValue(undefined)
    renderHook(() =>
      useDiscoverableWhilePairing(params({ pairingScreenShown: true, setDiscoverable })),
    )
    expect(setDiscoverable).toHaveBeenCalledTimes(1)

    advance(3000)
    expect(setDiscoverable).toHaveBeenCalledTimes(2)
    advance(6000)
    expect(setDiscoverable).toHaveBeenCalledTimes(4)
  })

  it('stops re-asserting once the screen goes away', () => {
    const setDiscoverable = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      (p: UseDiscoverableWhilePairingParams) => useDiscoverableWhilePairing(p),
      { initialProps: params({ pairingScreenShown: true, setDiscoverable }) },
    )
    advance(3000)
    setDiscoverable.mockClear()

    rerender(params({ pairingScreenShown: false, setDiscoverable }))
    expect(setDiscoverable).toHaveBeenCalledWith(false)

    setDiscoverable.mockClear()
    advance(9000)
    expect(setDiscoverable).not.toHaveBeenCalled()
  })

  it('leaves it alone entirely while the Bluetooth menu is up', () => {
    const setDiscoverable = vi.fn().mockResolvedValue(undefined)
    renderHook(() =>
      useDiscoverableWhilePairing(
        params({ pairingScreenShown: true, btMenuOpen: true, setDiscoverable }),
      ),
    )
    advance(9000)
    expect(setDiscoverable).not.toHaveBeenCalled()
  })

  it('swallows a rejected call rather than surfacing it', async () => {
    const setDiscoverable = vi.fn().mockRejectedValue(new Error('adapter busy'))
    renderHook(() =>
      useDiscoverableWhilePairing(params({ pairingScreenShown: true, setDiscoverable })),
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(setDiscoverable).toHaveBeenCalledWith(true)
  })
})
