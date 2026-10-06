import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useSwipeGestures } from '../useSwipeGestures'

afterEach(cleanup)

it('previews a horizontal drag, commits on release, and never skips on cancellation', () => {
  const next = vi.fn(),
    drag = vi.fn(),
    released = vi.fn()
  function Player({ allowed = true }) {
    const ref = useSwipeGestures<HTMLDivElement>({
      enabled: true,
      onNext: next,
      onPrev: vi.fn(),
      onToggleView: vi.fn(),
      onDrag: drag,
      onDragEnd: released,
      canNext: allowed,
    })
    return <div ref={ref} data-testid="stage" />
  }
  const { getByTestId, rerender } = render(<Player />)
  const el = getByTestId('stage')
  const points = (x: number) => [{ identifier: 1, clientX: x, clientY: 100 }]
  const move = () => {
    fireEvent.touchStart(el, { touches: points(250), changedTouches: points(250) })
    fireEvent.touchMove(el, { touches: points(100), changedTouches: points(100) })
  }
  move()
  expect(drag).toHaveBeenLastCalledWith(-150)
  expect(next).not.toHaveBeenCalled()
  fireEvent.touchCancel(el, { touches: [], changedTouches: points(100) })
  expect(released).toHaveBeenLastCalledWith(false)
  expect(next).not.toHaveBeenCalled()
  move()
  fireEvent.touchEnd(el, { touches: [], changedTouches: points(100) })
  expect(next).toHaveBeenCalledTimes(1)
  rerender(<Player allowed={false} />)
  move()
  fireEvent.touchEnd(el, { touches: [], changedTouches: points(100) })
  expect(next).toHaveBeenCalledTimes(1)
  expect(released).toHaveBeenLastCalledWith(false)
})
