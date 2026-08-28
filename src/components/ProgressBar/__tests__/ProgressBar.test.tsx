import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ProgressBar } from '../ProgressBar'
import { activeStatus } from '../../../__tests__/fixtures/observer'
import { NarrationContext } from '@/hooks/useDJNarration'

// the DJ hold is stateful and lives above these components, so it arrives via context
function talking(node: React.ReactNode) {
  return (
    <NarrationContext.Provider value={{ narrating: true, title: 'Up next', artist: 'DJ X' }}>
      {node}
    </NarrationContext.Provider>
  )
}

// transition logic is in scrubMachine.test.ts

// jsdom returns a zero-width rect by default, patch a width on the .bar
function mockBarRect(slider: HTMLElement, width: number) {
  const bar = slider.querySelector(':scope > div')
  if (!bar) throw new Error('expected bar element inside slider')
  ;(bar as HTMLElement).getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width,
      height: 6,
      top: 0,
      left: 0,
      right: width,
      bottom: 6,
      toJSON: () => ({}),
    }) as DOMRect
}

function stubPointerCapture(el: HTMLElement) {
  el.setPointerCapture = () => undefined
  el.releasePointerCapture = () => undefined
}

describe('ProgressBar DOM event wiring', () => {
  it('routes pointerdown pointerup into a seek call at the tapped position', () => {
    const onSeek = vi.fn()
    render(<ProgressBar status={activeStatus} onSeek={onSeek} />)

    const slider = screen.getByRole('slider')
    mockBarRect(slider, 800)
    stubPointerCapture(slider)

    // tap at 400/800 = 0.5, fixture duration 180_000ms, expect 90_000
    fireEvent.pointerDown(slider, { clientX: 400, pointerId: 1 })
    fireEvent.pointerUp(slider, { clientX: 400, pointerId: 1 })

    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(90_000)
  })

  it('does not fire a seek when interrupted by pointercancel', () => {
    // regression test for the "drag goes to position 0" bug
    const onSeek = vi.fn()
    // dev-mode warn fires on cancel
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      render(<ProgressBar status={activeStatus} onSeek={onSeek} />)

      const slider = screen.getByRole('slider')
      mockBarRect(slider, 800)
      stubPointerCapture(slider)

      fireEvent.pointerDown(slider, { clientX: 400, pointerId: 1 })
      fireEvent.pointerMove(slider, { clientX: 560, pointerId: 1 })
      fireEvent.pointerCancel(slider, { clientX: 0, pointerId: 1 })

      expect(onSeek).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('pointercancel during scrub'),
        expect.anything(),
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('does not fire a seek when seeking is disallowed', () => {
    const onSeek = vi.fn()
    render(<ProgressBar status={{ ...activeStatus, disallow_seek: true }} onSeek={onSeek} />)

    const slider = screen.getByRole('slider')
    mockBarRect(slider, 800)
    stubPointerCapture(slider)

    fireEvent.pointerDown(slider, { clientX: 400, pointerId: 1 })
    fireEvent.pointerUp(slider, { clientX: 400, pointerId: 1 })

    expect(slider).toHaveAttribute('aria-disabled', 'true')
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('greys out and refuses seeks while the DJ is talking', () => {
    // the position belongs to the next song, not the speech you are hearing
    const onSeek = vi.fn()
    render(talking(<ProgressBar status={activeStatus} onSeek={onSeek} />))

    const slider = screen.getByRole('slider')
    mockBarRect(slider, 800)
    stubPointerCapture(slider)

    fireEvent.pointerDown(slider, { clientX: 400, pointerId: 1 })
    fireEvent.pointerUp(slider, { clientX: 400, pointerId: 1 })

    expect(slider).toHaveAttribute('aria-disabled', 'true')
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('shows no times and no fill while the DJ is talking', () => {
    const { container, rerender } = render(talking(<ProgressBar status={activeStatus} />))

    const times = container.querySelectorAll('span')
    expect(times.length).toBe(2)
    times.forEach((t) => expect(t.textContent).toBe(''))

    const fill = screen.getByRole('slider').querySelector(':scope > div > div > div')
    expect((fill as HTMLElement).style.transform).toBe('scaleX(0)')

    // and the real duration comes back once the DJ stops
    rerender(<ProgressBar status={activeStatus} />)
    expect(container.querySelectorAll('span')[1].textContent).not.toBe('')
  })

  it('stays seekable when the DJ is not talking', () => {
    const onSeek = vi.fn()
    // no provider at all: the context default must mean "not narrating"
    render(<ProgressBar status={activeStatus} onSeek={onSeek} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-disabled', 'false')
  })
})
