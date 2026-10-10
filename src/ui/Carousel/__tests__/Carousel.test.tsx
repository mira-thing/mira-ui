import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, REVERSAL_GAP_MS, withRouter } from '@/__tests__/hardware'
import type { KnobStep } from '@/input/knob'
import { useKnobNav } from '@/input/useKnobNav'
import { Carousel, trackOffset } from '..'

const KEYS = ['a', 'b', 'c', 'd', 'e']
const LEAD = 24
const GAP = 16
const WIDTH = 196
const FOCUSED_WIDTH = 264
const VIEWPORT = 800

// lays the options out from their classes, the way the stylesheet would
function widthOf(el: HTMLElement): number {
  return el.classList.contains('focused') ? FOCUSED_WIDTH : WIDTH
}
function leftOf(el: HTMLElement): number {
  let left = LEAD
  for (let s = el.previousElementSibling; s; s = s.previousElementSibling) {
    left += widthOf(s as HTMLElement) + GAP
  }
  return left
}

function Harness({ onSelect = () => {} }: { onSelect?: (key: string) => void }) {
  const nav = useKnobNav({ keys: KEYS, onSelect })
  return (
    <Carousel
      items={KEYS}
      keyOf={(k) => k}
      nav={nav}
      leadPx={LEAD}
      renderItem={(k, { focused }) => <span data-focused={String(focused)}>{k}</span>}
    />
  )
}

const track = () => screen.getByRole('listbox')
const options = () => screen.getAllByRole('option')

describe('trackOffset', () => {
  const base = { contentEnd: 1136, viewportWidth: 800, leadPx: 24 }

  it('insets the focused item by the lead', () => {
    expect(trackOffset({ ...base, itemLeft: 236 })).toBe(212)
  })

  it('never scrolls before the start or past the end', () => {
    expect(trackOffset({ ...base, itemLeft: 24 })).toBe(0)
    expect(trackOffset({ ...base, itemLeft: 900 })).toBe(360)
  })

  it('stays put when everything fits', () => {
    expect(trackOffset({ itemLeft: 300, contentEnd: 500, viewportWidth: 800, leadPx: 24 })).toBe(0)
  })
})

describe('Carousel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute('role') === 'option' ? leftOf(this) : 0
    })
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getAttribute('role') === 'option' ? widthOf(this) : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('carousel') ? VIEWPORT : 0
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const turn = (n: number, dir: KnobStep) => {
    hw.turnSteps(n, dir, { advance })
    advance(REVERSAL_GAP_MS)
  }

  it('widens only the focused item, by class', () => {
    render(<Harness />, { wrapper: withRouter })

    expect(options()[0]).toHaveClass('item', 'focused')
    expect(options()[1]).not.toHaveClass('focused')
    expect(screen.getByText('a')).toHaveAttribute('data-focused', 'true')
  })

  it('places the first item at rest without animating it there', () => {
    render(<Harness />, { wrapper: withRouter })

    expect(track().style.transform).toBe('translate3d(0px, 0, 0)')
    expect(track().style.transition).toBe('')
  })

  it('moves the track to the focused item’s measured offset, after it widens', () => {
    render(<Harness />, { wrapper: withRouter })

    turn(1, 1)
    expect(options()[1]).toHaveClass('focused')
    // b sits after a at its narrow width: 24 + 196 + 16, less the lead
    expect(track().style.transform).toBe('translate3d(-212px, 0, 0)')
  })

  it('clamps at the end, so the last item never pulls away from the edge', () => {
    render(<Harness />, { wrapper: withRouter })

    turn(10, 1)
    expect(options()[4]).toHaveClass('focused')
    // the track ends at 24 + 264 + 4 * 196 + 4 * 16 = 1136, plus the lead, less the viewport
    expect(track().style.transform).toBe('translate3d(-360px, 0, 0)')

    turn(10, -1)
    expect(options()[0]).toHaveClass('focused')
    expect(track().style.transform).toBe('translate3d(0px, 0, 0)')
  })

  it('selects an unfocused item on tap, focusing it first', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />, { wrapper: withRouter })

    fireEvent.click(options()[2])
    expect(onSelect).toHaveBeenCalledWith('c')
    expect(options()[2]).toHaveClass('focused')
  })

  it('selects the focused item on a press', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />, { wrapper: withRouter })

    turn(1, 1)
    hw.press()
    expect(onSelect).toHaveBeenCalledWith('b')
  })
})
