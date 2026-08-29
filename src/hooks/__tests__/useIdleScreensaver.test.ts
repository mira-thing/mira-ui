import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  idleScreensaverEligible,
  SCREENSAVER_AUTO_MS,
  useIdleScreensaver,
  type IdleEligibility,
  type UseIdleScreensaverParams,
} from '../useIdleScreensaver'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatus } from '@/api/types'

const idle: ObserverStatus = { active: false, message: 'no session' }

describe('idleScreensaverEligible', () => {
  // a settled idle screen: nothing playing, nothing else on top of it
  function input(over: Partial<IdleEligibility> = {}): IdleEligibility {
    return {
      open: false,
      busy: false,
      consentOpen: false,
      updateCardOpen: false,
      loading: false,
      status: idle,
      ...over,
    }
  }

  it('allows a settled idle screen', () => {
    expect(idleScreensaverEligible(input())).toBe(true)
  })

  it.each([
    ['it is already up', { open: true }],
    ['something else owns the screen', { busy: true }],
    ['the consent card is waiting on an answer', { consentOpen: true }],
    ['the update card is up', { updateCardOpen: true }],
    ['we are still loading', { loading: true }],
    ['the daemon has not answered yet', { status: null }],
    ['something is playing', { status: activeStatus }],
    [
      'first-boot setup is running',
      { status: { active: false, setting_up: true } as ObserverStatus },
    ],
  ])('stands down while %s', (_why, over) => {
    expect(idleScreensaverEligible(input(over))).toBe(false)
  })
})

describe('useIdleScreensaver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  function params(over: Partial<UseIdleScreensaverParams> = {}): UseIdleScreensaverParams {
    return {
      open: false,
      openedBy: 'manual',
      busy: false,
      consentOpen: false,
      updateCardOpen: false,
      loading: false,
      status: idle,
      onOpen: vi.fn(),
      onClose: vi.fn(),
      ...over,
    }
  }

  it('opens after ten quiet minutes', () => {
    const onOpen = vi.fn()
    renderHook(() => useIdleScreensaver(params({ onOpen })))

    advance(SCREENSAVER_AUTO_MS - 1)
    expect(onOpen).not.toHaveBeenCalled()
    advance(1)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('never opens while something else owns the screen', () => {
    const onOpen = vi.fn()
    renderHook(() => useIdleScreensaver(params({ busy: true, onOpen })))
    advance(SCREENSAVER_AUTO_MS * 2)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it.each(['pointerdown', 'keydown', 'wheel'] as const)('restarts the countdown on %s', (event) => {
    const onOpen = vi.fn()
    renderHook(() => useIdleScreensaver(params({ onOpen })))

    advance(SCREENSAVER_AUTO_MS - 1000)
    act(() => void window.dispatchEvent(new Event(event)))

    advance(SCREENSAVER_AUTO_MS - 1000)
    expect(onOpen).not.toHaveBeenCalled() // the first stretch does not carry over
    advance(1000)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('stops listening once it is no longer eligible', () => {
    const onOpen = vi.fn()
    const { rerender } = renderHook((p: UseIdleScreensaverParams) => useIdleScreensaver(p), {
      initialProps: params({ onOpen }),
    })

    rerender(params({ busy: true, onOpen }))
    advance(SCREENSAVER_AUTO_MS * 2)
    expect(onOpen).not.toHaveBeenCalled()
  })

  describe('yielding to playback', () => {
    it('closes an auto-opened saver when a device starts playing', () => {
      const onClose = vi.fn()
      renderHook(() =>
        useIdleScreensaver(params({ open: true, openedBy: 'auto', status: activeStatus, onClose })),
      )
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('leaves a hand-opened saver alone: that is desk mode', () => {
      const onClose = vi.fn()
      renderHook(() =>
        useIdleScreensaver(
          params({ open: true, openedBy: 'manual', status: activeStatus, onClose }),
        ),
      )
      expect(onClose).not.toHaveBeenCalled()
    })

    it('leaves an auto-opened saver up while nothing is playing', () => {
      const onClose = vi.fn()
      renderHook(() => useIdleScreensaver(params({ open: true, openedBy: 'auto', onClose })))
      expect(onClose).not.toHaveBeenCalled()
    })
  })
})
