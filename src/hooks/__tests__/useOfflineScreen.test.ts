import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  resolveOfflineScreen,
  useOfflineScreen,
  type OfflineScreenInput,
  type UseOfflineScreenParams,
} from '../useOfflineScreen'
import { activeStatus } from '../../__tests__/fixtures/observer'

describe('resolveOfflineScreen', () => {
  // offline, nothing known about the user, no decision made yet
  function input(over: Partial<OfflineScreenInput> = {}): OfflineScreenInput {
    return {
      active: true,
      checking: false,
      btConnected: false,
      hasKnownDevice: false,
      wasOnline: false,
      setupOverride: false,
      method: 'chooser',
      ...over,
    }
  }

  it('shows nothing while we are not calling it offline', () => {
    expect(resolveOfflineScreen(input({ active: false, checking: true }))).toBeNull()
  })

  it('checks before it accuses', () => {
    expect(resolveOfflineScreen(input({ checking: true, btConnected: true }))).toBe('checking')
  })

  it('asks for tethering when the phone is here but carrying no internet', () => {
    expect(resolveOfflineScreen(input({ btConnected: true }))).toBe('tethering')
  })

  it('waits on a known phone to come back', () => {
    expect(resolveOfflineScreen(input({ hasKnownDevice: true }))).toBe('reconnecting')
  })

  it('waits on a connection that used to work, even with nothing paired', () => {
    expect(resolveOfflineScreen(input({ wasOnline: true }))).toBe('reconnecting')
  })

  it('offers the chooser on a first boot with nothing to go on', () => {
    expect(resolveOfflineScreen(input())).toBe('chooser')
  })

  it('follows the chosen method once the user picks one', () => {
    expect(resolveOfflineScreen(input({ method: 'pc' }))).toBe('pc')
    expect(resolveOfflineScreen(input({ method: 'bluetooth' }))).toBe('bluetooth')
  })

  it('lets an explicit setup override outrank what we would have picked', () => {
    const known = { btConnected: true, hasKnownDevice: true, wasOnline: true }
    expect(resolveOfflineScreen(input(known))).toBe('tethering')
    expect(resolveOfflineScreen(input({ ...known, setupOverride: true, method: 'pc' }))).toBe('pc')
  })

  it('still checks first, even under an override', () => {
    expect(resolveOfflineScreen(input({ checking: true, setupOverride: true, method: 'pc' }))).toBe(
      'checking',
    )
  })
})

describe('useOfflineScreen', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  function params(over: Partial<UseOfflineScreenParams> = {}): UseOfflineScreenParams {
    return {
      suppressed: false,
      online: false,
      carriers: null,
      btConnectedDevice: null,
      hasKnownDevice: false,
      wasOnline: false,
      heldStatus: null,
      bootStuck: false,
      reconnecting: false,
      ...over,
    }
  }

  it('takes a first boot at its word without waiting out the holdoff', () => {
    const { result } = renderHook(() => useOfflineScreen(params()))
    expect(result.current.screen).toBe('chooser')
  })

  it('holds off before calling a connection that worked before offline', () => {
    const { result } = renderHook(() => useOfflineScreen(params({ wasOnline: true })))
    expect(result.current.screen).toBeNull()
    advance(10_000)
    expect(result.current.screen).toBe('reconnecting')
  })

  it('says it is checking while a link is still coming up', () => {
    // something played, so a link was working a moment ago
    const { result } = renderHook(() => useOfflineScreen(params({ heldStatus: activeStatus })))
    expect(result.current.screen).toBe('checking')

    // the grace period runs out and the verdict lands
    advance(6_000)
    expect(result.current.screen).toBe('chooser')
  })

  it('gives each new milestone its own grace period', () => {
    const { result, rerender } = renderHook(
      ({ carriers }) => useOfflineScreen(params({ wasOnline: true, carriers })),
      { initialProps: { carriers: null as { usb: boolean; bt: boolean } | null } },
    )
    advance(10_000)
    expect(result.current.screen).toBe('reconnecting')

    // the phone bonds: worth another look before we go back to accusing
    rerender({ carriers: { usb: false, bt: true } })
    expect(result.current.screen).toBe('checking')
    advance(6_000)
    expect(result.current.screen).toBe('reconnecting')
  })

  it('stands down for a dev screen and for a recoverable drop', () => {
    const { result: dev } = renderHook(() => useOfflineScreen(params({ suppressed: true })))
    expect(dev.current.screen).toBeNull()

    const { result: drop } = renderHook(() => useOfflineScreen(params({ reconnecting: true })))
    expect(drop.current.screen).toBeNull()
  })

  it('falls through to offline when the boot never finds a network', () => {
    const { result } = renderHook(() =>
      useOfflineScreen(params({ online: null, bootStuck: true, wasOnline: true })),
    )
    expect(result.current.screen).toBe('reconnecting')
  })

  it('drops a setup override once the connection comes back', () => {
    const { result, rerender } = renderHook(({ online }) => useOfflineScreen(params({ online })), {
      initialProps: { online: false as boolean | null },
    })
    act(() => result.current.setSetupOverride(true))
    expect(result.current.setupOverride).toBe(true)

    rerender({ online: true })
    expect(result.current.setupOverride).toBe(false)
  })

  it('keeps a stable identity so the back handler is not rebuilt each render', () => {
    const { result, rerender } = renderHook(() => useOfflineScreen(params()))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
