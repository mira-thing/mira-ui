import { act, render } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clockParts } from '@/utils/clock'
import { useMinuteClock } from '../useMinuteClock'

function Clock({ offset }: { offset: number | null }) {
  return <span>{clockParts(useMinuteClock(offset)).time}</span>
}

describe('useMinuteClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 14, 21, 4, 30))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders once per minute, at the boundary, and never in between', () => {
    const commits = vi.fn()
    const { container } = render(
      <Profiler id="clock" onRender={commits}>
        <Clock offset={null} />
      </Profiler>,
    )
    expect(container).toHaveTextContent('9:04')
    commits.mockClear()

    act(() => vi.advanceTimersByTime(29_999))
    expect(commits).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(container).toHaveTextContent('9:05')
    expect(commits).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(60_000))
    expect(container).toHaveTextContent('9:06')
    expect(commits).toHaveBeenCalledTimes(2)
  })

  it('catches up within a second when the system clock jumps', () => {
    const { container } = render(<Clock offset={null} />)
    vi.setSystemTime(new Date(2026, 10, 14, 23, 30, 0))
    act(() => vi.advanceTimersByTime(1_000))
    expect(container).toHaveTextContent('11:30')
  })

  it('follows a new offset at once', () => {
    const { container, rerender } = render(<Clock offset={0} />)
    const before = container.textContent
    rerender(<Clock offset={60} />)
    expect(container.textContent).not.toBe(before)
  })

  it('leaves no timer behind on unmount', () => {
    const { unmount } = render(<Clock offset={null} />)
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
