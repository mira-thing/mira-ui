import type { ReactNode } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, REVERSAL_GAP_MS, withRouter } from '@/__tests__/hardware'
import { PageActiveContext } from '@/app/pageActive'
import type { KnobStep } from '../knob'
import { Layer } from '../router'
import { useKnobNav, type KnobNavOptions } from '../useKnobNav'
import { useKnobScope } from '../useKnobScope'

type Opts = Omit<KnobNavOptions<string>, 'onSelect'> & { onSelect?: (key: string) => void }

function List({ onSelect = () => {}, ...opts }: Opts) {
  const nav = useKnobNav({ ...opts, onSelect })
  return (
    <ul>
      {opts.keys.map((k) => {
        const { focused, ...item } = nav.itemProps(k)
        return (
          <li key={k} data-testid={k} className={focused ? 'focused' : undefined} {...item}>
            {k}
          </li>
        )
      })}
      <output data-testid="focus">{`${nav.focusKey ?? '-'}@${nav.focusIndex}`}</output>
    </ul>
  )
}

// the volume scope sits under every page
function Volume({ onStep, onSelect }: { onStep: () => void; onSelect: () => void }) {
  useKnobScope({ layer: Layer.base, enabled: true, onStep, onSelect })
  return null
}

describe('useKnobNav', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const turn = (n: number, dir: KnobStep) => {
    hw.turnSteps(n, dir, { advance })
    advance(REVERSAL_GAP_MS)
  }
  const focus = () => screen.getByTestId('focus').textContent

  function setup(opts: Opts, { active = true }: { active?: boolean } = {}) {
    const volume = { onStep: vi.fn(), onSelect: vi.fn() }
    const ui = (o: Opts, children?: ReactNode) => (
      <PageActiveContext.Provider value={active}>
        <Volume {...volume} />
        <List {...o} />
        {children}
      </PageActiveContext.Provider>
    )
    const r = render(ui(opts), { wrapper: withRouter })
    return { volume, rerender: (o: Opts) => r.rerender(ui(o)) }
  }

  it('starts on the first key and moves one key per detent, clockwise forward', () => {
    setup({ keys: ['a', 'b', 'c'] })
    expect(focus()).toBe('a@0')
    expect(screen.getByTestId('a')).toHaveClass('focused')
    expect(screen.getByTestId('a')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('b')).toHaveAttribute('aria-selected', 'false')

    turn(1, 1)
    expect(focus()).toBe('b@1')
    expect(screen.getByTestId('b')).toHaveClass('focused')
    expect(screen.getByTestId('a')).not.toHaveClass('focused')
    turn(1, -1)
    expect(focus()).toBe('a@0')
  })

  it('clamps at both ends and still keeps the knob from the volume', () => {
    const { volume } = setup({ keys: ['a', 'b', 'c'] })
    turn(5, 1)
    expect(focus()).toBe('c@2')
    turn(5, -1)
    expect(focus()).toBe('a@0')
    expect(volume.onStep).not.toHaveBeenCalled()
  })

  it('wraps only when asked', () => {
    setup({ keys: ['a', 'b', 'c'], wrap: true })
    turn(1, -1)
    expect(focus()).toBe('c@2')
    turn(1, 1)
    expect(focus()).toBe('a@0')
  })

  it('selects the focused key on a press, without play/pause', () => {
    const onSelect = vi.fn()
    const { volume } = setup({ keys: ['a', 'b'], onSelect })
    turn(1, 1)
    hw.press()
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('b')
    expect(volume.onSelect).not.toHaveBeenCalled()
  })

  it('follows its key when the list shifts', () => {
    const { rerender } = setup({ keys: ['a', 'b', 'c'] })
    turn(1, 1)
    rerender({ keys: ['x', 'y', 'a', 'b', 'c'] })
    expect(focus()).toBe('b@3')
    rerender({ keys: ['b', 'c'] })
    expect(focus()).toBe('b@0')
  })

  it('holds the index when its key goes away, then follows the key it landed on', () => {
    const { rerender } = setup({ keys: ['a', 'b', 'c'] })
    turn(1, 1)
    rerender({ keys: ['a', 'c'] })
    expect(focus()).toBe('c@1')
    rerender({ keys: ['x', 'a', 'c'] })
    expect(focus()).toBe('c@2')
    rerender({ keys: ['x'] })
    expect(focus()).toBe('x@0')
  })

  it('swallows the knob on an empty list, and focuses the first key once keys arrive', () => {
    const onSelect = vi.fn()
    const { volume, rerender } = setup({ keys: [], onSelect })
    expect(focus()).toBe('-@-1')
    turn(2, 1)
    hw.press()
    expect(volume.onStep).not.toHaveBeenCalled()
    expect(volume.onSelect).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()

    rerender({ keys: ['a', 'b'], onSelect })
    expect(focus()).toBe('a@0')
  })

  it('lets the knob through and ignores taps while the page is not active', () => {
    const onSelect = vi.fn()
    const { volume } = setup({ keys: ['a', 'b'], onSelect }, { active: false })
    turn(1, 1)
    hw.press()
    fireEvent.click(screen.getByTestId('b'))
    expect(focus()).toBe('a@0')
    expect(onSelect).not.toHaveBeenCalled()
    expect(volume.onStep).toHaveBeenCalledWith(1)
    expect(volume.onSelect).toHaveBeenCalledOnce()
  })

  it('lets the knob through while disabled', () => {
    const { volume } = setup({ keys: ['a', 'b'], enabled: false })
    turn(1, 1)
    expect(focus()).toBe('a@0')
    expect(volume.onStep).toHaveBeenCalledOnce()
  })

  it('focuses a tapped key, then selects it', () => {
    const onSelect = vi.fn()
    const onFocus = vi.fn()
    setup({ keys: ['a', 'b', 'c'], onSelect, onFocus })
    fireEvent.click(screen.getByTestId('c'))
    expect(focus()).toBe('c@2')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('c')
    expect(onFocus).toHaveBeenCalledExactlyOnceWith('c')
  })

  it('focuses a disabled key but neither a press nor a tap selects it', () => {
    const onSelect = vi.fn()
    const { volume } = setup({ keys: ['a', 'b'], onSelect, disabled: (k) => k === 'b' })
    turn(1, 1)
    expect(focus()).toBe('b@1')
    hw.press()
    fireEvent.click(screen.getByTestId('b'))
    expect(onSelect).not.toHaveBeenCalled()
    expect(volume.onSelect).not.toHaveBeenCalled()
    expect(screen.getByTestId('b')).toHaveAttribute('disabled')
  })

  it('seeds focus from restoreKey ahead of defaultKey', () => {
    setup({ keys: ['a', 'b', 'c'], defaultKey: 'b', restoreKey: 'c' })
    expect(focus()).toBe('c@2')
  })

  it('falls back to defaultKey when the restored key is gone', () => {
    setup({ keys: ['a', 'b', 'c'], defaultKey: 'b', restoreKey: 'zzz' })
    expect(focus()).toBe('b@1')
  })

  it('restores a key that arrives after the first render', () => {
    const { rerender } = setup({ keys: [], restoreKey: 'c' })
    rerender({ keys: ['a', 'b', 'c'], restoreKey: 'c' })
    expect(focus()).toBe('c@2')
  })

  it('reports focus moves for saving, but not the seed', () => {
    const onFocus = vi.fn()
    const { rerender } = setup({ keys: ['a', 'b', 'c'], restoreKey: 'b', onFocus })
    expect(onFocus).not.toHaveBeenCalled()
    turn(1, 1)
    expect(onFocus).toHaveBeenLastCalledWith('c')
    rerender({ keys: ['a', 'b'], restoreKey: 'b', onFocus })
    expect(onFocus).toHaveBeenLastCalledWith('b')
    expect(onFocus).toHaveBeenCalledTimes(2)
  })

  it('warns about duplicate keys, which focus could never reach', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderHook(() => useKnobNav({ keys: ['a', 'b', 'a'], onSelect: () => {} }), {
      wrapper: withRouter,
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate keys'), ['a', 'b', 'a'])
    warn.mockRestore()
  })
})
