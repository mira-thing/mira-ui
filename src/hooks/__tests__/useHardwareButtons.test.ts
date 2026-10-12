import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useHardwareButtons, type UseHardwareButtonsParams } from '../useHardwareButtons'
import { activeStatus } from '@/__tests__/fixtures/observer'
import { hw, withRouter } from '@/__tests__/hardware'

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

describe('useHardwareButtons volume on a device that cannot take it', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const turn = () => hw.turnSteps(1, -1, { advance })

  it('flashes the overlay once, then holds still while the knob keeps spinning', async () => {
    const setVolume = vi.fn(() => Promise.reject(new Error('no volume control')))
    const p = params({ status: { ...activeStatus, volume_disabled: true }, setVolume })
    const { result } = renderHook(() => useHardwareButtons(p), { wrapper: withRouter })

    turn()
    expect(result.current.volumeOverlay.visible).toBe(true)
    await act(async () => {})
    expect(result.current.volumeOverlay.visible).toBe(false)

    for (let i = 0; i < 5; i++) turn()
    expect(result.current.volumeOverlay.visible).toBe(false)
    expect(setVolume).toHaveBeenCalledTimes(1)
    expect(p.notify).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(4000))
    turn()
    expect(result.current.volumeOverlay.visible).toBe(true)
    expect(setVolume).toHaveBeenCalledTimes(2)
  })
})

describe('useHardwareButtons knob', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const VOLUME_MAX = 65535
  // the default 2% step
  const STEP = Math.round(0.02 * VOLUME_MAX)

  it('turns the volume up clockwise and down counter-clockwise', () => {
    const p = params({ status: { ...activeStatus, volume: 30000 } })
    renderHook(() => useHardwareButtons(p), { wrapper: withRouter })

    hw.turnSteps(2, 1, { advance })
    advance(200)
    expect(p.setVolume).toHaveBeenLastCalledWith(30000 + 2 * STEP, false)

    hw.turnSteps(1, -1, { advance })
    advance(200)
    expect(p.setVolume).toHaveBeenLastCalledWith(30000 + STEP, false)
  })

  it('leaves the volume alone with nothing playing, but still keeps the wheel from scrolling', () => {
    const p = params({ status: null })
    renderHook(() => useHardwareButtons(p), { wrapper: withRouter })

    const e = hw.turn(1)
    advance(200)
    expect(e.defaultPrevented).toBe(true)
    expect(p.setVolume).not.toHaveBeenCalled()
  })

  // the sync grace runs from the last turn, not the last accepted step
  it('holds off the device volume sync after a turn the step filter dropped', () => {
    const initial = params({ status: { ...activeStatus, volume: 30000 } })
    const { rerender } = renderHook((x: UseHardwareButtonsParams) => useHardwareButtons(x), {
      initialProps: initial,
      wrapper: withRouter,
    })

    hw.turn(1)
    advance(30)
    // dropped by the 55ms minimum interval
    hw.turn(1)
    // 1510ms after the accepted step, inside the 1500ms grace only if the dropped turn counts
    advance(1480)

    const latest = params({ status: { ...activeStatus, volume: 50000 } })
    rerender(latest)
    hw.turn(1)
    advance(200)
    expect(latest.setVolume).toHaveBeenLastCalledWith(30000 + 2 * STEP, false)
  })

  it('plays or pauses on a knob press, and claims the key', () => {
    const p = params()
    renderHook(() => useHardwareButtons(p), { wrapper: withRouter })

    const e = hw.press()
    expect(p.onPlayPause).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('goes back on the back button', () => {
    const p = params()
    renderHook(() => useHardwareButtons(p), { wrapper: withRouter })

    hw.back()
    expect(p.onBack).toHaveBeenCalledTimes(1)
    expect(p.onPlayPause).not.toHaveBeenCalled()
  })
})
