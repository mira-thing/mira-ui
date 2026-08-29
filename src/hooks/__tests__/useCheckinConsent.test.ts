import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCheckinConsent, type UseCheckinConsentParams } from '../useCheckinConsent'
import { __resetSettings, getSettings } from '@/settings'
import type { ObserverStatus, ObserverStatusInactive } from '@/api/types'

const idle = (over: Partial<Omit<ObserverStatusInactive, 'active'>> = {}): ObserverStatus => ({
  active: false,
  message: 'no session',
  ...over,
})

describe('useCheckinConsent', () => {
  beforeEach(() => __resetSettings())

  // a quiet idle screen with the daemon still waiting on an answer
  function params(over: Partial<UseCheckinConsentParams> = {}): UseCheckinConsentParams {
    return {
      status: idle({ checkin_consent: 'unset' }),
      loading: false,
      open: false,
      busy: false,
      updateCardOpen: false,
      onAsk: vi.fn(),
      onAnswered: vi.fn(),
      ...over,
    }
  }

  it('asks once the screen is quiet and the daemon has no answer yet', () => {
    const onAsk = vi.fn()
    renderHook(() => useCheckinConsent(params({ onAsk })))
    expect(onAsk).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the card is already up', { open: true }],
    ['something else owns the screen', { busy: true }],
    ['the update card is up', { updateCardOpen: true }],
    ['we are still loading', { loading: true }],
    ['the daemon has not answered yet', { status: null }],
    [
      'first-boot setup is running',
      { status: idle({ checkin_consent: 'unset', setting_up: true }) },
    ],
  ])('does not ask while %s', (_why, over) => {
    const onAsk = vi.fn()
    renderHook(() => useCheckinConsent(params({ ...over, onAsk })))
    expect(onAsk).not.toHaveBeenCalled()
  })

  it.each(['granted', 'denied', 'disabled'] as const)(
    'does not ask again once the daemon reports %s',
    (consent) => {
      const onAsk = vi.fn()
      renderHook(() =>
        useCheckinConsent(params({ status: idle({ checkin_consent: consent }), onAsk })),
      )
      expect(onAsk).not.toHaveBeenCalled()
    },
  )

  it('records the answer and closes the card', () => {
    const onAnswered = vi.fn()
    const { result } = renderHook(() => useCheckinConsent(params({ onAnswered })))

    act(() => result.current.choose('granted'))
    expect(getSettings().checkinConsent).toBe('granted')
    expect(onAnswered).toHaveBeenCalledTimes(1)
  })

  it('does not ask again while the daemon still reports the old answer', () => {
    // the daemon takes a moment to catch up; asking twice would be worse
    const onAsk = vi.fn()
    const { result, rerender } = renderHook((p: UseCheckinConsentParams) => useCheckinConsent(p), {
      initialProps: params({ onAsk }),
    })
    expect(onAsk).toHaveBeenCalledTimes(1)

    act(() => result.current.choose('denied'))
    rerender(params({ onAsk }))
    expect(onAsk).toHaveBeenCalledTimes(1)
  })
})
