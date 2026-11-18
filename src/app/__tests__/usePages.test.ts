import { describe, expect, expectTypeOf, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  initialPages,
  initialPagesFor,
  pagesReducer,
  usePages,
  type PageRoute,
  type RouteOf,
} from '../usePages'

// a stack with a page that takes params, as a detail page would
type StubRoute = RouteOf<{ list: undefined; detail: { uri: string } }>
const stubRoot = initialPagesFor<StubRoute>({ id: 'list' })

describe('pagesReducer', () => {
  it('starts on home alone', () => {
    expect(initialPages.stack).toEqual([{ id: 'home', key: 0 }])
    expect(initialPages.previous).toBeNull()
  })

  it('pushes a fresh entry and remembers the one it covered', () => {
    const once = pagesReducer(initialPages, { type: 'push', route: { id: 'player' } })
    const twice = pagesReducer(once, { type: 'push', route: { id: 'queue' } })

    expect(twice.stack.map((e) => e.key)).toEqual([0, 1, 2])
    expect(twice.stack.map((e) => e.id)).toEqual(['home', 'player', 'queue'])
    expect(twice.previous).toBe(once.stack[1])
  })

  it('carries a page’s params on its entry', () => {
    const state = pagesReducer(stubRoot, {
      type: 'push',
      route: { id: 'detail', params: { uri: 'spotify:playlist:1' } },
    })

    expect(state.stack[1]).toEqual({ id: 'detail', params: { uri: 'spotify:playlist:1' }, key: 1 })
  })

  it('types params per page', () => {
    expectTypeOf<{ id: 'detail'; params: { uri: string } }>().toExtend<StubRoute>()
    expectTypeOf<{ id: 'detail' }>().not.toExtend<StubRoute>()
    expectTypeOf<{ id: 'list'; params: { uri: string } }>().not.toExtend<StubRoute>()
    expectTypeOf<{ id: 'nope' }>().not.toExtend<PageRoute>()
  })

  it('pushes silently, with nothing to animate out', () => {
    const state = pagesReducer(initialPages, {
      type: 'push',
      route: { id: 'player' },
      silent: true,
    })

    expect(state.stack.map((e) => e.id)).toEqual(['home', 'player'])
    expect(state.previous).toBeNull()
  })

  it('pops the top and hands it over as the one leaving', () => {
    const pushed = pagesReducer(initialPages, { type: 'push', route: { id: 'player' } })
    const popped = pagesReducer(pushed, { type: 'pop' })

    expect(popped.stack).toEqual(initialPages.stack)
    expect(popped.previous).toBe(pushed.stack[1])
  })

  it('never pops the root', () => {
    expect(pagesReducer(initialPages, { type: 'pop' })).toBe(initialPages)
  })

  it('resets to the root, leaving from whatever was on top', () => {
    let state = initialPages
    state = pagesReducer(state, { type: 'push', route: { id: 'player' } })
    state = pagesReducer(state, { type: 'push', route: { id: 'queue' } })
    const top = state.stack[2]
    state = pagesReducer(state, { type: 'reset' })

    expect(state.stack).toEqual(initialPages.stack)
    expect(state.previous).toBe(top)
    expect(pagesReducer(state, { type: 'reset' })).toBe(state)
  })

  describe('drop', () => {
    it('leaves from the top like a pop when the page is on top', () => {
      const pushed = pagesReducer(initialPages, { type: 'push', route: { id: 'player' } })
      const dropped = pagesReducer(pushed, { type: 'drop', id: 'player' })

      expect(dropped.stack).toEqual(initialPages.stack)
      expect(dropped.previous).toBe(pushed.stack[1])
    })

    it('takes it out from under the top without touching what is leaving', () => {
      let state = pagesReducer(initialPages, { type: 'push', route: { id: 'player' } })
      state = pagesReducer(state, { type: 'push', route: { id: 'queue' } })
      const leaving = state.previous
      state = pagesReducer(state, { type: 'drop', id: 'player' })

      expect(state.stack.map((e) => e.id)).toEqual(['home', 'queue'])
      expect(state.previous).toBe(leaving)
    })

    it('never drops the root, and changes nothing when the page is absent', () => {
      const pushed = pagesReducer(initialPages, { type: 'push', route: { id: 'playlists' } })

      expect(pagesReducer(pushed, { type: 'drop', id: 'player' })).toBe(pushed)
      expect(pagesReducer(pushed, { type: 'drop', id: 'home' })).toBe(pushed)
    })
  })

  it('saves the focus on the top entry only, and keeps it through a push and pop', () => {
    let state = pagesReducer(initialPages, { type: 'setFocusKey', focusKey: 'queue' })
    state = pagesReducer(state, { type: 'push', route: { id: 'playlists' } })
    state = pagesReducer(state, { type: 'setFocusKey', focusKey: 'row-3' })

    expect(state.stack.map((e) => e.focusKey)).toEqual(['queue', 'row-3'])

    state = pagesReducer(state, { type: 'pop' })
    expect(state.stack[0].focusKey).toBe('queue')
  })

  it('does not churn the state for a focus key it already has', () => {
    const state = pagesReducer(initialPages, { type: 'setFocusKey', focusKey: 'a' })
    expect(pagesReducer(state, { type: 'setFocusKey', focusKey: 'a' })).toBe(state)
  })
})

describe('usePages', () => {
  it('exposes the top of the stack, its depth and the entry that left', () => {
    const { result } = renderHook(() => usePages())
    expect(result.current.current).toEqual({ id: 'home', key: 0 })
    expect(result.current.depth).toBe(1)

    act(() => result.current.push({ id: 'player' }))
    expect(result.current.current).toEqual({ id: 'player', key: 1 })
    expect(result.current.previous?.key).toBe(0)
    expect(result.current.depth).toBe(2)
  })

  it('reports whether a pop happened', () => {
    const { result } = renderHook(() => usePages())
    act(() => result.current.push({ id: 'player' }))

    let popped: boolean[] = []
    act(() => {
      popped = [result.current.pop(), result.current.pop()]
    })
    // the second press in the same tick sees the first one's pop
    expect(popped).toEqual([true, false])
    expect(result.current.depth).toBe(1)
  })

  it('resets, drops and saves focus through the hook', () => {
    const { result } = renderHook(() => usePages())
    act(() => {
      result.current.push({ id: 'player' })
      result.current.push({ id: 'queue' })
    })
    act(() => result.current.drop('player'))
    expect(result.current.depth).toBe(2)
    expect(result.current.current.id).toBe('queue')

    act(() => result.current.reset())
    expect(result.current.depth).toBe(1)

    act(() => result.current.setFocusKey('more'))
    expect(result.current.current.focusKey).toBe('more')
  })

  it('keeps its actions stable across stack changes', () => {
    const { result } = renderHook(() => usePages())
    const { push, pop, reset, drop, setFocusKey } = result.current
    act(() => result.current.push({ id: 'player' }))

    expect(result.current.push).toBe(push)
    expect(result.current.pop).toBe(pop)
    expect(result.current.reset).toBe(reset)
    expect(result.current.drop).toBe(drop)
    expect(result.current.setFocusKey).toBe(setFocusKey)
  })
})
