import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  updateCardEligible,
  useUpdateNotice,
  type UpdateEligibility,
  type UseUpdateNoticeParams,
} from '../useUpdateNotice'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatus, ObserverStatusInactive } from '@/api/types'

const idle = (over: Partial<Omit<ObserverStatusInactive, 'active'>> = {}): ObserverStatus => ({
  active: false,
  message: 'no session',
  ...over,
})

const offered = idle({
  update_available: true,
  update_mandatory: false,
  latest_version: '1.2.0',
  latest_highlights: ['Clock screensaver'],
})

describe('updateCardEligible', () => {
  // an optional update on offer, on a settled idle screen
  function input(over: Partial<UpdateEligibility> = {}): UpdateEligibility {
    return {
      available: true,
      mandatory: false,
      version: '1.2.0',
      highlights: [],
      skippedVersion: '',
      open: false,
      consentOpen: false,
      busy: false,
      loading: false,
      status: idle(),
      ...over,
    }
  }

  it('offers an available update on a quiet screen', () => {
    expect(updateCardEligible(input())).toBe(true)
  })

  it('says nothing when there is no update', () => {
    expect(updateCardEligible(input({ available: false }))).toBe(false)
  })

  it('respects a skipped version until a newer one ships', () => {
    expect(updateCardEligible(input({ skippedVersion: '1.2.0' }))).toBe(false)
    expect(updateCardEligible(input({ skippedVersion: '1.1.0' }))).toBe(true)
  })

  it('ignores a skip when the update is mandatory', () => {
    expect(updateCardEligible(input({ mandatory: true, skippedVersion: '1.2.0' }))).toBe(true)
  })

  it.each([
    ['it is already up', { open: true }],
    ['the consent card is asking first', { consentOpen: true }],
    ['something else owns the screen', { busy: true }],
    ['we are still loading', { loading: true }],
    ['the daemon has not answered yet', { status: null }],
    ['something is playing', { status: activeStatus }],
    ['first-boot setup is running', { status: idle({ setting_up: true }) }],
  ])('waits while %s', (_why, over) => {
    expect(updateCardEligible(input(over))).toBe(false)
  })
})

describe('useUpdateNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  function params(over: Partial<UseUpdateNoticeParams> = {}): UseUpdateNoticeParams {
    return {
      status: offered,
      loading: false,
      open: false,
      consentOpen: false,
      busy: false,
      remindAt: 0,
      onShow: vi.fn(),
      onDismiss: vi.fn(),
      ...over,
    }
  }

  it('reports what the daemon is offering', () => {
    const { result } = renderHook(() => useUpdateNotice(params()))
    expect(result.current.version).toBe('1.2.0')
    expect(result.current.highlights).toEqual(['Clock screensaver'])
    expect(result.current.mandatory).toBe(false)
  })

  it('lets the idle screen land before interrupting it', () => {
    const onShow = vi.fn()
    renderHook(() => useUpdateNotice(params({ onShow })))
    advance(1499)
    expect(onShow).not.toHaveBeenCalled()
    advance(1)
    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('holds off until the remind-at time has passed', () => {
    const onShow = vi.fn()
    renderHook(() => useUpdateNotice(params({ remindAt: Date.now() + 60_000, onShow })))
    advance(59_000)
    expect(onShow).not.toHaveBeenCalled()
    advance(1_000)
    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('gets out of the way when playback starts', () => {
    const onDismiss = vi.fn()
    renderHook(() => useUpdateNotice(params({ open: true, status: activeStatus, onDismiss })))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  describe('skip', () => {
    it('drops the offered version and remembers it across boots', () => {
      const onDismiss = vi.fn()
      const { result } = renderHook(() => useUpdateNotice(params({ onDismiss })))

      act(() => result.current.skip())
      expect(window.localStorage.getItem('mira.skippedVersion')).toBe('1.2.0')
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('stops the card coming back for that version', () => {
      const onShow = vi.fn()
      const { result } = renderHook(() => useUpdateNotice(params({ onShow })))
      act(() => result.current.skip())

      onShow.mockClear()
      advance(60_000)
      expect(onShow).not.toHaveBeenCalled()
    })

    it('does not silence a newer version', () => {
      window.localStorage.setItem('mira.skippedVersion', '1.1.0')
      const onShow = vi.fn()
      renderHook(() => useUpdateNotice(params({ onShow })))
      advance(1500)
      expect(onShow).toHaveBeenCalledTimes(1)
    })
  })
})
