import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { initialPages, pagesReducer, usePages } from '../usePages'

describe('pagesReducer', () => {
  it('starts on the player alone', () => {
    expect(initialPages.stack).toEqual([{ id: 'player', key: 0 }])
    expect(initialPages.previous).toBeNull()
  })

  it('pushes a fresh entry and remembers the one it covered', () => {
    const once = pagesReducer(initialPages, { type: 'push', id: 'player' })
    const twice = pagesReducer(once, { type: 'push', id: 'player' })

    expect(twice.stack.map((e) => e.key)).toEqual([0, 1, 2])
    expect(twice.previous).toBe(once.stack[1])
  })

  it('pops the top and hands it over as the one leaving', () => {
    const pushed = pagesReducer(initialPages, { type: 'push', id: 'player' })
    const popped = pagesReducer(pushed, { type: 'pop' })

    expect(popped.stack).toEqual(initialPages.stack)
    expect(popped.previous).toBe(pushed.stack[1])
  })

  it('never pops the root', () => {
    expect(pagesReducer(initialPages, { type: 'pop' })).toBe(initialPages)
  })

  it('resets to the root, leaving from whatever was on top', () => {
    let state = initialPages
    state = pagesReducer(state, { type: 'push', id: 'player' })
    state = pagesReducer(state, { type: 'push', id: 'player' })
    const top = state.stack[2]
    state = pagesReducer(state, { type: 'reset' })

    expect(state.stack).toEqual(initialPages.stack)
    expect(state.previous).toBe(top)
    expect(pagesReducer(state, { type: 'reset' })).toBe(state)
  })

  it('saves the focus on the top entry only, and keeps it through a push and pop', () => {
    let state = pagesReducer(initialPages, { type: 'setFocusKey', focusKey: 'lyrics' })
    state = pagesReducer(state, { type: 'push', id: 'player' })
    state = pagesReducer(state, { type: 'setFocusKey', focusKey: 'row-3' })

    expect(state.stack.map((e) => e.focusKey)).toEqual(['lyrics', 'row-3'])

    state = pagesReducer(state, { type: 'pop' })
    expect(state.stack[0].focusKey).toBe('lyrics')
  })

  it('does not churn the state for a focus key it already has', () => {
    const state = pagesReducer(initialPages, { type: 'setFocusKey', focusKey: 'a' })
    expect(pagesReducer(state, { type: 'setFocusKey', focusKey: 'a' })).toBe(state)
  })
})

describe('usePages', () => {
  it('exposes the top of the stack, its depth and the entry that left', () => {
    const { result } = renderHook(() => usePages())
    expect(result.current.current).toEqual({ id: 'player', key: 0 })
    expect(result.current.depth).toBe(1)

    act(() => result.current.push('player'))
    expect(result.current.current.key).toBe(1)
    expect(result.current.previous?.key).toBe(0)
    expect(result.current.depth).toBe(2)
  })

  it('reports whether a pop happened', () => {
    const { result } = renderHook(() => usePages())
    act(() => result.current.push('player'))

    let popped: boolean[] = []
    act(() => {
      popped = [result.current.pop(), result.current.pop()]
    })
    // the second press in the same tick sees the first one's pop
    expect(popped).toEqual([true, false])
    expect(result.current.depth).toBe(1)
  })

  it('resets and saves focus through the hook', () => {
    const { result } = renderHook(() => usePages())
    act(() => {
      result.current.push('player')
      result.current.push('player')
    })
    act(() => result.current.reset())
    expect(result.current.depth).toBe(1)

    act(() => result.current.setFocusKey('more'))
    expect(result.current.current.focusKey).toBe('more')
  })

  it('keeps its actions stable across stack changes', () => {
    const { result } = renderHook(() => usePages())
    const { push, pop, reset, setFocusKey } = result.current
    act(() => result.current.push('player'))

    expect(result.current.push).toBe(push)
    expect(result.current.pop).toBe(pop)
    expect(result.current.reset).toBe(reset)
    expect(result.current.setFocusKey).toBe(setFocusKey)
  })
})
