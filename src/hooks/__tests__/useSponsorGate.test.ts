import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { SPONSOR_AFTER_PLAY_MS, useSponsorGate, type UseSponsorGateParams } from '../useSponsorGate'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatus } from '@/api/types'

const idle: ObserverStatus = { active: false, message: 'no session' }

describe('useSponsorGate', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  function params(over: Partial<UseSponsorGateParams> = {}): UseSponsorGateParams {
    return {
      status: activeStatus,
      shown: () => false,
      onShow: vi.fn(),
      ...over,
    }
  }

  it('asks after three unbroken minutes of playback', () => {
    const onShow = vi.fn()
    renderHook(() => useSponsorGate(params({ onShow })))
    advance(SPONSOR_AFTER_PLAY_MS - 1)
    expect(onShow).not.toHaveBeenCalled()
    advance(1)
    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('never asks while nothing is playing', () => {
    const onShow = vi.fn()
    renderHook(() => useSponsorGate(params({ status: idle, onShow })))
    advance(SPONSOR_AFTER_PLAY_MS * 2)
    expect(onShow).not.toHaveBeenCalled()
  })

  it('never asks during first-boot setup', () => {
    const onShow = vi.fn()
    const settingUp = { ...activeStatus, setting_up: true }
    renderHook(() => useSponsorGate(params({ status: settingUp, onShow })))
    advance(SPONSOR_AFTER_PLAY_MS * 2)
    expect(onShow).not.toHaveBeenCalled()
  })

  it('never asks twice, including across boots', () => {
    const onShow = vi.fn()
    renderHook(() => useSponsorGate(params({ shown: () => true, onShow })))
    advance(SPONSOR_AFTER_PLAY_MS * 2)
    expect(onShow).not.toHaveBeenCalled()
  })

  it('drops the ask if it was shown while the timer was running', () => {
    // the power menu can open it by hand mid-countdown
    let shown = false
    const onShow = vi.fn()
    renderHook(() => useSponsorGate(params({ shown: () => shown, onShow })))

    advance(SPONSOR_AFTER_PLAY_MS - 1000)
    shown = true
    advance(1000)
    expect(onShow).not.toHaveBeenCalled()
  })

  it('starts the three minutes over if playback stops', () => {
    const onShow = vi.fn()
    const { rerender } = renderHook((p: UseSponsorGateParams) => useSponsorGate(p), {
      initialProps: params({ onShow }),
    })

    advance(SPONSOR_AFTER_PLAY_MS - 1000)
    rerender(params({ status: idle, onShow }))
    advance(2000)
    expect(onShow).not.toHaveBeenCalled()

    rerender(params({ onShow }))
    advance(SPONSOR_AFTER_PLAY_MS - 1)
    expect(onShow).not.toHaveBeenCalled()
    advance(1)
    expect(onShow).toHaveBeenCalledTimes(1)
  })
})
