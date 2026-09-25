import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useHardwareButtons, type UseHardwareButtonsParams } from '../useHardwareButtons'
import { activeStatus } from '@/__tests__/fixtures/observer'

function params(over: Partial<UseHardwareButtonsParams> = {}): UseHardwareButtonsParams {
  return {
    status: null,
    onPlayPause: vi.fn(),
    setVolume: vi.fn(),
    playContext: vi.fn(),
    inDJSet: false,
    djNarrating: false,
    onDJSignal: vi.fn(),
    onBack: vi.fn(),
    onTogglePowerMenu: vi.fn(),
    onScreensaver: vi.fn(),
    onOpenDebug: vi.fn(),
    notify: vi.fn(),
    ...over,
  }
}

// the power button is KeyM; a press is a keydown/keyup pair
function press() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM' }))
  })
}

describe('useHardwareButtons power button', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  it('opens the power menu on a single press', () => {
    const p = params()
    renderHook(() => useHardwareButtons(p))

    press()
    expect(p.onTogglePowerMenu).not.toHaveBeenCalled() // still waiting on a second
    advance(400)
    expect(p.onTogglePowerMenu).toHaveBeenCalledTimes(1)
    expect(p.onScreensaver).not.toHaveBeenCalled()
  })

  it('opens the screensaver on a double press', () => {
    const p = params()
    renderHook(() => useHardwareButtons(p))

    press()
    press()
    advance(400)
    expect(p.onScreensaver).toHaveBeenCalledTimes(1)
    expect(p.onTogglePowerMenu).not.toHaveBeenCalled()
  })

  // the observer polls every 3s and App rebuilds these handlers inline, so a
  // re-render lands mid-gesture routinely
  it('survives a re-render between the two presses', () => {
    const { rerender } = renderHook((p: UseHardwareButtonsParams) => useHardwareButtons(p), {
      initialProps: params(),
    })

    press()
    const second = params()
    rerender(second)
    press()
    advance(400)

    expect(second.onScreensaver).toHaveBeenCalledTimes(1)
    expect(second.onTogglePowerMenu).not.toHaveBeenCalled()
  })

  it('calls the handlers it was last given, not the ones it mounted with', () => {
    const { rerender } = renderHook((p: UseHardwareButtonsParams) => useHardwareButtons(p), {
      initialProps: params(),
    })

    const latest = params()
    rerender(latest)
    press()
    advance(400)

    expect(latest.onTogglePowerMenu).toHaveBeenCalledTimes(1)
  })
})

// holding a preset for 2s saves the current context to that slot; the effect's
// cleanup clears that timer, so a re-render mid-hold used to cancel the save
describe('useHardwareButtons preset buttons', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const hold = (up: boolean) =>
    act(() => {
      window.dispatchEvent(new KeyboardEvent(up ? 'keyup' : 'keydown', { code: 'Digit2' }))
    })

  const playing = {
    ...activeStatus,
    context_uri: 'spotify:playlist:abc',
    context_name: 'Road Trip',
  }

  it('saves the playing context when a slot is held through a re-render', () => {
    const { rerender } = renderHook((x: UseHardwareButtonsParams) => useHardwareButtons(x), {
      initialProps: params({ status: playing }),
    })

    hold(false)
    advance(1000)
    const latest = params({ status: playing })
    rerender(latest)
    advance(1000)
    hold(true)

    expect(latest.notify).toHaveBeenCalledWith(
      expect.stringContaining('to preset 2'),
      expect.objectContaining({ variant: 'success' }),
    )
  })
})
