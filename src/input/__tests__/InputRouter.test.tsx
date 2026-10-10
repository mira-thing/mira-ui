import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, STEP_GAP_MS, withRouter } from '@/__tests__/hardware'
import type { KnobStep } from '../knob'
import { Layer, type KnobScope } from '../router'
import { useKnobScope, useKnobTurn } from '../useKnobScope'

function Scope(props: KnobScope) {
  useKnobScope(props)
  return null
}

function Turns({ onTurn }: { onTurn: (dir: KnobStep) => void }) {
  useKnobTurn(onTurn)
  return null
}

describe('InputRouter', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const turn = (dir: KnobStep) => hw.turnSteps(1, dir, { advance })

  it('hands the knob to the top layer first', () => {
    const lower = vi.fn()
    const modal = vi.fn()
    render(
      <>
        <Scope layer={Layer.base} enabled onStep={lower} onSelect={lower} />
        <Scope layer={Layer.modal} enabled onStep={modal} onSelect={modal} />
        <Scope layer={Layer.page} enabled onStep={lower} onSelect={lower} />
      </>,
      { wrapper: withRouter },
    )

    turn(1)
    hw.press()
    expect(modal).toHaveBeenCalledTimes(2)
    expect(modal).toHaveBeenNthCalledWith(1, 1)
    expect(lower).not.toHaveBeenCalled()
  })

  it('falls through to the next scope down when a handler returns false', () => {
    const page = vi.fn(() => false)
    const base = vi.fn()
    render(
      <>
        <Scope layer={Layer.base} enabled onStep={base} onSelect={base} />
        <Scope layer={Layer.page} enabled onStep={page} onSelect={page} />
      </>,
      { wrapper: withRouter },
    )

    turn(-1)
    hw.press()
    expect(page).toHaveBeenCalledTimes(2)
    expect(base).toHaveBeenCalledTimes(2)
    expect(base).toHaveBeenNthCalledWith(1, -1)
  })

  it('skips a scope that has no handler for the input', () => {
    const modalSelect = vi.fn()
    const base = vi.fn()
    render(
      <>
        <Scope layer={Layer.base} enabled onStep={base} />
        <Scope layer={Layer.modal} enabled onSelect={modalSelect} />
      </>,
      { wrapper: withRouter },
    )

    turn(1)
    expect(base).toHaveBeenCalledWith(1)
    hw.press()
    expect(modalSelect).toHaveBeenCalledTimes(1)
  })

  it('skips a disabled scope, and picks it up once enabled', () => {
    const modal = vi.fn()
    const base = vi.fn()
    const tree = (enabled: boolean) => (
      <>
        <Scope layer={Layer.base} enabled onStep={base} />
        <Scope layer={Layer.modal} enabled={enabled} onStep={modal} />
      </>
    )
    const { rerender } = render(tree(false), { wrapper: withRouter })

    turn(1)
    expect(base).toHaveBeenCalledTimes(1)
    expect(modal).not.toHaveBeenCalled()

    rerender(tree(true))
    turn(1)
    expect(modal).toHaveBeenCalledTimes(1)
    expect(base).toHaveBeenCalledTimes(1)
  })

  it('gives a tie within a layer to the latest mount, even after the other re-renders', () => {
    const first = vi.fn()
    const firstAgain = vi.fn()
    const second = vi.fn()
    const tree = (onFirst: () => void, show = true) => (
      <>
        {show ? <Scope key="a" layer={Layer.page} enabled onStep={onFirst} /> : null}
        <Scope key="b" layer={Layer.page} enabled onStep={second} />
      </>
    )
    const { rerender } = render(tree(first), { wrapper: withRouter })

    turn(1)
    expect(second).toHaveBeenCalledTimes(1)

    rerender(tree(firstAgain))
    turn(1)
    expect(second).toHaveBeenCalledTimes(2)
    expect(first).not.toHaveBeenCalled()
    expect(firstAgain).not.toHaveBeenCalled()

    // a remount is a new mount, so it goes ahead of the scope that stayed
    rerender(tree(firstAgain, false))
    rerender(tree(firstAgain))
    turn(1)
    expect(firstAgain).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
  })

  it('does nothing without a router above it', () => {
    const onStep = vi.fn()
    const onSelect = vi.fn()
    render(<Scope layer={Layer.modal} enabled onStep={onStep} onSelect={onSelect} />)

    const wheel = hw.turn(1)
    const press = hw.press()
    expect(onStep).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
    expect(wheel.defaultPrevented).toBe(false)
    expect(press.defaultPrevented).toBe(false)
  })

  it('cancels the knob scroll without stopping its propagation', () => {
    render(<Scope layer={Layer.base} enabled onStep={vi.fn()} />, { wrapper: withRouter })
    // registered after the router, like the idle screensaver's timer reset
    const windowCapture = vi.fn()
    const bodyBubble = vi.fn()
    window.addEventListener('wheel', windowCapture, { capture: true })
    document.body.addEventListener('wheel', bodyBubble)
    try {
      const e = hw.turn(1)
      expect(e.defaultPrevented).toBe(true)
      expect(windowCapture).toHaveBeenCalledTimes(1)
      expect(bodyBubble).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('wheel', windowCapture, { capture: true })
      document.body.removeEventListener('wheel', bodyBubble)
    }
  })

  it('leaves a vertical wheel alone', () => {
    const onStep = vi.fn()
    const onTurn = vi.fn()
    render(
      <>
        <Scope layer={Layer.base} enabled onStep={onStep} />
        <Turns onTurn={onTurn} />
      </>,
      { wrapper: withRouter },
    )

    const e = new WheelEvent('wheel', { deltaY: 60, bubbles: true, cancelable: true })
    act(() => {
      document.body.dispatchEvent(e)
    })
    expect(e.defaultPrevented).toBe(false)
    expect(onStep).not.toHaveBeenCalled()
    expect(onTurn).not.toHaveBeenCalled()
  })

  it('cancels the knob scroll even when no scope takes the step', () => {
    render(<Scope layer={Layer.base} enabled onStep={() => false} />, { wrapper: withRouter })
    expect(hw.turn(1).defaultPrevented).toBe(true)
  })

  it('claims the press only when a scope handles it', () => {
    const { rerender } = render(<Scope layer={Layer.base} enabled onSelect={() => false} />, {
      wrapper: withRouter,
    })
    expect(hw.press().defaultPrevented).toBe(false)

    rerender(<Scope layer={Layer.base} enabled onSelect={() => {}} />)
    expect(hw.press().defaultPrevented).toBe(true)
  })

  it('lets a capture-phase shield block the press', () => {
    const onSelect = vi.fn()
    render(<Scope layer={Layer.modal} enabled onSelect={onSelect} />, { wrapper: withRouter })
    const shield = (e: KeyboardEvent) => e.stopPropagation()
    window.addEventListener('keydown', shield, { capture: true })
    try {
      hw.press()
      expect(onSelect).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', shield, { capture: true })
    }
    hw.press()
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('reports every turn to subscribers, including the ones the step filter drops', () => {
    const onStep = vi.fn()
    const onTurn = vi.fn()
    render(
      <>
        <Scope layer={Layer.base} enabled onStep={onStep} />
        <Turns onTurn={onTurn} />
      </>,
      { wrapper: withRouter },
    )

    hw.turn(1)
    hw.turn(1)
    hw.turn(-1)
    expect(onStep).toHaveBeenCalledTimes(1)
    expect(onTurn.mock.calls).toEqual([[1], [1], [-1]])
  })

  it('shares one debounce across a change of owner', () => {
    const modal = vi.fn()
    const base = vi.fn()
    const tree = (modalOpen: boolean) => (
      <>
        <Scope layer={Layer.base} enabled onStep={base} />
        {modalOpen ? <Scope layer={Layer.modal} enabled onStep={modal} /> : null}
      </>
    )
    const { rerender } = render(tree(true), { wrapper: withRouter })

    hw.turn(1)
    expect(modal).toHaveBeenCalledTimes(1)

    rerender(tree(false))
    advance(STEP_GAP_MS / 2)
    hw.turn(1)
    expect(base).not.toHaveBeenCalled()

    advance(STEP_GAP_MS)
    hw.turn(1)
    expect(base).toHaveBeenCalledTimes(1)
  })
})
