import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { hw, REVERSAL_GAP_MS, withRouter } from '@/__tests__/hardware'
import type { KnobStep } from '@/input/knob'
import { PowerMenu } from '../PowerMenu'

const system = vi.hoisted(() => ({
  suspendDevice: vi.fn(() => Promise.resolve()),
  restartDevice: vi.fn(() => Promise.resolve()),
  resetDevice: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/api/system', () => system)

describe('PowerMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.values(system).forEach((fn) => fn.mockClear())
  })
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const turn = (n: number, dir: KnobStep) => {
    hw.turnSteps(n, dir, { advance })
    advance(REVERSAL_GAP_MS)
  }
  const focused = () => document.querySelector('.focused')?.textContent
  const confirmFocused = () =>
    screen.getByRole('dialog', { name: 'Reset device?' }).querySelector('.focused')?.textContent

  function setup() {
    const props = { open: true, onClose: vi.fn(), onSupport: vi.fn() }
    render(<PowerMenu {...props} />, { wrapper: withRouter })
    return props
  }

  it('walks the actions with the knob and presses the focused one', () => {
    const props = setup()
    expect(focused()).toMatch(/^Sleep/)
    turn(3, 1)
    expect(focused()).toMatch(/^Support/)
    hw.press()
    expect(props.onSupport).toHaveBeenCalledTimes(1)
  })

  it('asks before resetting, with Cancel under the knob', () => {
    setup()
    turn(2, 1)
    hw.press()
    expect(screen.getByRole('dialog', { name: 'Reset device?' })).toBeInTheDocument()
    expect(confirmFocused()).toMatch(/^Cancel/)
    hw.press()
    expect(screen.queryByRole('dialog', { name: 'Reset device?' })).toBeNull()
    expect(system.resetDevice).not.toHaveBeenCalled()
  })

  it('resets once confirmed', () => {
    setup()
    fireEvent.click(screen.getByText('Reset'))
    turn(1, 1)
    expect(confirmFocused()).toMatch(/^Reset/)
    hw.press()
    expect(system.resetDevice).toHaveBeenCalledTimes(1)
  })

  it('drops a pending confirm by the next open', () => {
    const props = { open: true, onClose: vi.fn() }
    const { rerender } = render(<PowerMenu {...props} />, { wrapper: withRouter })
    fireEvent.click(screen.getByText('Reset'))
    rerender(<PowerMenu {...props} open={false} />)
    rerender(<PowerMenu {...props} open />)
    expect(screen.getByRole('dialog', { name: 'Power' })).toBeInTheDocument()
  })
})
