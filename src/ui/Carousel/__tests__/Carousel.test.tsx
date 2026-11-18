import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, REVERSAL_GAP_MS, withRouter } from '@/__tests__/hardware'
import type { KnobStep } from '@/input/knob'
import { useKnobNav } from '@/input/useKnobNav'
import { Carousel, trackOffset } from '..'
import { restOffsets, rubberBand, swipeTarget } from '../carouselMath'

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

describe('restOffsets', () => {
  const widths = [264, 196, 196, 196, 196]

  it('narrows the focused item for every item after it', () => {
    const lefts = [24, 304, 516, 728, 940]
    expect(restOffsets({ lefts, widths, from: 0, viewportWidth: 800, leadPx: 24 })).toEqual([
      0, 212, 360, 360, 360,
    ])
  })

  it('leaves the items before the focused one where they are', () => {
    const lefts = [24, 236, 448, 660, 872]
    const last = [196, 196, 196, 196, 264]
    expect(restOffsets({ lefts, widths: last, from: 4, viewportWidth: 800, leadPx: 24 })).toEqual([
      0, 212, 360, 360, 360,
    ])
  })
})

describe('swipeTarget', () => {
  const rests = [0, 212, 424, 636, 848]

  it('lands on the item whose resting offset is nearest the let-go offset', () => {
    expect(swipeTarget(rests, 0, 250, -250)).toBe(1)
    expect(swipeTarget(rests, 0, 520, -520)).toBe(2)
  })

  it('moves at least one item once the drag passes a step', () => {
    expect(swipeTarget(rests, 0, 60, -60)).toBe(1)
    expect(swipeTarget(rests, 2, 364, 60)).toBe(1)
    expect(swipeTarget(rests, 0, 30, -30)).toBe(0)
  })

  it('keeps the item it started on when others rest at the same clamped offset', () => {
    const clamped = [0, 212, 360, 360, 360]
    expect(swipeTarget(clamped, 4, 345, 15)).toBe(4)
    expect(swipeTarget(clamped, 4, 300, 60)).toBe(3)
  })

  it('never leaves the ends', () => {
    expect(swipeTarget(rests, 0, -80, 80)).toBe(0)
    expect(swipeTarget(rests, 4, 2000, -2000)).toBe(4)
  })
})

describe('rubberBand', () => {
  it('follows the finger inside the track and a third of it past either end', () => {
    expect(rubberBand(100, 300)).toBe(100)
    expect(rubberBand(-90, 300)).toBe(-30)
    expect(rubberBand(390, 300)).toBe(330)
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

  describe('swipe', () => {
    const viewport = () => track().parentElement!
    const point = (x: number, y = 100) => ({ identifier: 0, clientX: x, clientY: y })
    function drag(fromX: number, toX: number, { y = 100, end = true } = {}) {
      fireEvent.touchStart(viewport(), {
        touches: [point(fromX)],
        changedTouches: [point(fromX)],
      })
      for (const x of [fromX + (toX - fromX) / 2, toX]) {
        const p = point(x, 100 + (y - 100) * ((x - fromX) / (toX - fromX || 1)))
        fireEvent.touchMove(viewport(), { touches: [p], changedTouches: [p] })
      }
      if (end) fireEvent.touchEnd(viewport(), { touches: [], changedTouches: [point(toX, y)] })
    }

    it('moves the track with the finger, rubber-banding past the start', () => {
      render(<Harness />, { wrapper: withRouter })

      drag(400, 300, { end: false })
      expect(track().style.transform).toBe('translate3d(-100px, 0, 0)')
      expect(track().style.transition).toBe('none')

      drag(300, 390, { end: false })
      expect(track().style.transform).toBe('translate3d(30px, 0, 0)')
    })

    it('focuses the item it is let go nearest', () => {
      render(<Harness />, { wrapper: withRouter })

      drag(500, 250)
      expect(options()[1]).toHaveClass('focused')
      expect(track().style.transition).toBe('')
      expect(track().style.transform).toBe('translate3d(-212px, 0, 0)')
    })

    it('steps one item for a short flick, and springs back from a shorter one', () => {
      render(<Harness />, { wrapper: withRouter })

      drag(500, 440)
      expect(options()[1]).toHaveClass('focused')

      drag(300, 280)
      expect(options()[1]).toHaveClass('focused')
      expect(track().style.transform).toBe('translate3d(-212px, 0, 0)')
    })

    it('leaves a vertical drag to the page', () => {
      render(<Harness />, { wrapper: withRouter })

      drag(500, 490, { y: 300 })
      expect(options()[0]).toHaveClass('focused')
      expect(track().style.transform).toBe('translate3d(0px, 0, 0)')
    })

    it('does not select the card a swipe ends on', () => {
      const onSelect = vi.fn()
      render(<Harness onSelect={onSelect} />, { wrapper: withRouter })

      drag(500, 250)
      fireEvent.click(options()[1])
      expect(onSelect).not.toHaveBeenCalled()

      advance(400)
      fireEvent.click(options()[1])
      expect(onSelect).toHaveBeenCalledWith('b')
    })

    it('selects on a tap straight after a swipe, which a swipe never clicks', () => {
      const onSelect = vi.fn()
      render(<Harness onSelect={onSelect} />, { wrapper: withRouter })

      drag(500, 250)
      drag(300, 300)
      fireEvent.click(options()[1])
      expect(onSelect).toHaveBeenCalledWith('b')
    })

    it('steps back one item from the end of the row, where several rest at the same offset', () => {
      render(<Harness />, { wrapper: withRouter })

      turn(10, 1)
      drag(300, 315)
      expect(options()[4]).toHaveClass('focused')
      drag(300, 360)
      expect(options()[3]).toHaveClass('focused')
    })

    it('leaves touch pointers to the touch path, so a touch is handled once', () => {
      render(<Harness />, { wrapper: withRouter })

      fireEvent.pointerDown(viewport(), { pointerId: 1, pointerType: 'touch', button: 0 })
      drag(500, 250)
      fireEvent.pointerUp(viewport(), { pointerId: 1, pointerType: 'touch', button: 0 })
      expect(options()[1]).toHaveClass('focused')
    })
  })

  describe('mouse drag', () => {
    const viewport = () => track().parentElement!
    const mouse = { pointerId: 7, pointerType: 'mouse', button: 0 }
    let capture: ReturnType<typeof vi.fn>
    beforeEach(() => {
      capture = vi.fn()
      Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
        value: capture,
        configurable: true,
      })
    })
    afterEach(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture
    })

    function mouseDrag(fromX: number, toX: number, { end = true, target = viewport() } = {}) {
      fireEvent.pointerDown(target, { ...mouse, clientX: fromX, clientY: 100, buttons: 1 })
      for (const x of [fromX + (toX - fromX) / 2, toX]) {
        fireEvent.pointerMove(viewport(), { ...mouse, clientX: x, clientY: 100, buttons: 1 })
      }
      if (end) fireEvent.pointerUp(viewport(), { ...mouse, clientX: toX, clientY: 100 })
    }

    it('moves the track with the mouse and focuses the item it is let go nearest', () => {
      render(<Harness />, { wrapper: withRouter })

      mouseDrag(500, 400, { end: false })
      expect(track().style.transform).toBe('translate3d(-100px, 0, 0)')
      expect(capture).toHaveBeenCalledWith(7)

      fireEvent.pointerMove(viewport(), { ...mouse, clientX: 250, clientY: 100, buttons: 1 })
      fireEvent.pointerUp(viewport(), { ...mouse, clientX: 250, clientY: 100 })
      expect(options()[1]).toHaveClass('focused')
      expect(track().style.transform).toBe('translate3d(-212px, 0, 0)')
    })

    it('does not select the card a drag ends on', () => {
      const onSelect = vi.fn()
      render(<Harness onSelect={onSelect} />, { wrapper: withRouter })

      mouseDrag(500, 250)
      fireEvent.click(options()[1])
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('still clicks through a drag too short to decide, without capturing', () => {
      const onSelect = vi.fn()
      render(<Harness onSelect={onSelect} />, { wrapper: withRouter })

      mouseDrag(500, 497, { target: options()[2] })
      fireEvent.click(options()[2])
      expect(capture).not.toHaveBeenCalled()
      expect(onSelect).toHaveBeenCalledWith('c')
    })

    it('springs back when the button comes up out of sight', () => {
      render(<Harness />, { wrapper: withRouter })

      mouseDrag(500, 250, { end: false })
      fireEvent.pointerMove(viewport(), { ...mouse, clientX: 100, clientY: 100, buttons: 0 })
      expect(options()[0]).toHaveClass('focused')
      expect(track().style.transform).toBe('translate3d(0px, 0, 0)')
    })

    it('ends a press let go off the carousel before it became a drag', () => {
      render(<Harness />, { wrapper: withRouter })

      fireEvent.pointerDown(viewport(), { ...mouse, clientX: 500, clientY: 200, buttons: 1 })
      fireEvent.pointerMove(viewport(), { ...mouse, clientX: 500, clientY: 20, buttons: 1 })
      fireEvent.pointerUp(document.body, { ...mouse, clientX: 500, clientY: 0 })

      mouseDrag(500, 250)
      expect(options()[1]).toHaveClass('focused')
    })

    it('ignores other buttons', () => {
      render(<Harness />, { wrapper: withRouter })

      fireEvent.pointerDown(viewport(), { ...mouse, button: 2, clientX: 500, clientY: 100 })
      fireEvent.pointerMove(viewport(), { ...mouse, clientX: 250, clientY: 100, buttons: 2 })
      fireEvent.pointerUp(viewport(), { ...mouse, button: 2, clientX: 250, clientY: 100 })
      expect(options()[0]).toHaveClass('focused')
      expect(track().style.transform).toBe('translate3d(0px, 0, 0)')
    })
  })
})
