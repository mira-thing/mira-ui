import { useMemo } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, REVERSAL_GAP_MS, withRouter } from '@/__tests__/hardware'
import type { KnobStep } from '@/input/knob'
import { useKnobNav } from '@/input/useKnobNav'
import { KnobList, ListRow, listKeys, type ListSection } from '..'

interface Track {
  id: string
}

const ROW_H = 50
const VIEWPORT_H = 200
const keyOf = (t: Track) => t.id
const tracks = (prefix: string, n: number): Track[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))

interface HarnessProps {
  sections: ListSection<Track>[]
  onSelect?: (key: string) => void
  onEndReached?: () => void
  overscan?: number
  disabled?: (key: string) => boolean
}

function Harness({
  sections,
  onSelect = () => {},
  onEndReached,
  overscan = 1,
  disabled,
}: HarnessProps) {
  const keys = useMemo(() => listKeys(sections, keyOf), [sections])
  const nav = useKnobNav({ keys, onSelect, disabled })
  return (
    <KnobList
      sections={sections}
      keyOf={keyOf}
      nav={nav}
      rowHeight={ROW_H}
      overscan={overscan}
      // inline, as a page would pass it: a new identity every render
      onEndReached={onEndReached && (() => onEndReached())}
      renderRow={(t, state) => <ListRow title={t.id} {...state} />}
      empty={<p>Nothing queued</p>}
    />
  )
}

const scroller = () => document.querySelector<HTMLElement>('.list')!
const rendered = () => screen.queryAllByRole('option').map((o) => o.textContent)
const focused = () => document.querySelector('[aria-selected="true"]')?.textContent

function scrollTo(top: number) {
  scroller().scrollTop = top
  fireEvent.scroll(scroller())
}

describe('KnobList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('list') ? VIEWPORT_H : 0
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

  it('skips section headers with the knob', () => {
    render(
      <Harness
        sections={[
          { key: 'next', title: 'Next in queue', items: tracks('q', 2) },
          { key: 'ctx', title: 'Next from Album', items: tracks('c', 2) },
        ]}
      />,
      { wrapper: withRouter },
    )
    expect(screen.getByText('Next in queue')).toBeInTheDocument()
    expect(focused()).toBe('q0')
    turn(2, 1)
    expect(focused()).toBe('c0')
    turn(1, -1)
    expect(focused()).toBe('q1')
  })

  it('places every row, headers included, at its fixed offset', () => {
    render(<Harness sections={[{ key: 's', title: 'Songs', items: tracks('t', 2) }]} />, {
      wrapper: withRouter,
    })
    const header = screen.getByText('Songs').closest<HTMLElement>('.row')!
    expect(header.style.top).toBe('0px')
    const second = screen.getByText('t1').closest<HTMLElement>('[role="option"]')!
    expect(second.style.top).toBe(`${2 * ROW_H}px`)
    expect(second.style.height).toBe(`${ROW_H}px`)
    expect(scroller().firstElementChild).toHaveStyle({ height: `${3 * ROW_H}px` })
  })

  it('renders only the visible rows and the overscan', () => {
    render(<Harness sections={[{ key: 's', items: tracks('t', 40) }]} />, {
      wrapper: withRouter,
    })
    expect(rendered()).toEqual(['t0', 't1', 't2', 't3', 't4'])

    scrollTo(20 * ROW_H)
    // rows 20-23 visible, 19 and 24 overscan, and the focused row kept mounted
    expect(rendered()).toEqual(['t19', 't20', 't21', 't22', 't23', 't24', 't0'])
  })

  it('scrolls the focused row into view with a row of context', () => {
    render(<Harness sections={[{ key: 's', items: tracks('t', 40) }]} />, {
      wrapper: withRouter,
    })
    turn(2, 1)
    expect(scroller().scrollTop).toBe(0)
    turn(1, 1)
    expect(focused()).toBe('t3')
    expect(scroller().scrollTop).toBe(ROW_H)
    expect(rendered()).toContain('t5')

    scrollTo(30 * ROW_H)
    turn(1, -1)
    expect(focused()).toBe('t2')
    expect(scroller().scrollTop).toBe(ROW_H)
  })

  it('focuses then selects a tapped row', () => {
    const onSelect = vi.fn()
    render(<Harness sections={[{ key: 's', items: tracks('t', 3) }]} onSelect={onSelect} />, {
      wrapper: withRouter,
    })
    fireEvent.click(screen.getByText('t2'))
    expect(focused()).toBe('t2')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('t2')
  })

  it('marks a disabled row and never selects it', () => {
    const onSelect = vi.fn()
    render(
      <Harness
        sections={[{ key: 's', items: tracks('t', 3) }]}
        onSelect={onSelect}
        disabled={(k) => k === 't1'}
      />,
      { wrapper: withRouter },
    )
    const option = screen.getByText('t1').closest('[role="option"]')!
    expect(option).toHaveAttribute('aria-disabled', 'true')
    expect(option).not.toHaveAttribute('disabled')
    expect(option.querySelector('button')).toBeDisabled()

    fireEvent.click(option)
    hw.press()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('fires onEndReached once per length as scroll nears the end', () => {
    const onEndReached = vi.fn()
    const { rerender } = render(
      <Harness sections={[{ key: 's', items: tracks('t', 10) }]} onEndReached={onEndReached} />,
      { wrapper: withRouter },
    )
    expect(onEndReached).not.toHaveBeenCalled()
    scrollTo(5 * ROW_H)
    scrollTo(6 * ROW_H)
    scrollTo(0)
    scrollTo(6 * ROW_H)
    expect(onEndReached).toHaveBeenCalledOnce()

    rerender(
      <Harness sections={[{ key: 's', items: tracks('t', 20) }]} onEndReached={onEndReached} />,
    )
    expect(onEndReached).toHaveBeenCalledOnce()
    scrollTo(16 * ROW_H)
    expect(onEndReached).toHaveBeenCalledTimes(2)
  })

  it('fires onEndReached once as the knob walks to the end', () => {
    const onEndReached = vi.fn()
    render(
      <Harness
        sections={[{ key: 's', items: tracks('t', 30) }]}
        onEndReached={onEndReached}
        overscan={2}
      />,
      { wrapper: withRouter },
    )
    turn(25, 1)
    expect(onEndReached).not.toHaveBeenCalled()
    // t26 scrolls row 28 into view, within the overscan of the last row
    turn(1, 1)
    expect(focused()).toBe('t26')
    expect(onEndReached).toHaveBeenCalledOnce()
    turn(3, 1)
    expect(onEndReached).toHaveBeenCalledOnce()
  })

  it('shows the empty state with no items, headers or not', () => {
    render(<Harness sections={[{ key: 's', title: 'Queue', items: [] }]} />, {
      wrapper: withRouter,
    })
    expect(screen.getByText('Nothing queued')).toBeInTheDocument()
    expect(screen.queryByText('Queue')).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
