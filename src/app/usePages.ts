import { useCallback, useMemo, useRef, useState } from 'react'

export type PageId = 'player' | 'ui-kit'

export interface PageEntry<Id extends string = PageId> {
  id: Id
  /** unique per push, so a page pushed twice mounts twice */
  key: number
  /** what had focus on the page, restored when it is uncovered */
  focusKey?: string
}

export interface PagesState {
  /** never empty; the player is always at the bottom */
  stack: readonly PageEntry[]
  /** the entry that last left the top, for the shell to animate out */
  previous: PageEntry | null
  nextKey: number
}

export type PagesAction =
  | { type: 'push'; id: PageId }
  | { type: 'pop' }
  | { type: 'reset' }
  | { type: 'setFocusKey'; focusKey: string }

export const initialPages: PagesState = {
  stack: [{ id: 'player', key: 0 }],
  previous: null,
  nextKey: 1,
}

/** Returns `state` itself when the action changes nothing. */
export function pagesReducer(state: PagesState, action: PagesAction): PagesState {
  const top = state.stack[state.stack.length - 1]
  switch (action.type) {
    case 'push':
      return {
        stack: [...state.stack, { id: action.id, key: state.nextKey }],
        previous: top,
        nextKey: state.nextKey + 1,
      }
    case 'pop':
      if (state.stack.length === 1) return state
      return { ...state, stack: state.stack.slice(0, -1), previous: top }
    case 'reset':
      if (state.stack.length === 1) return state
      return { ...state, stack: state.stack.slice(0, 1), previous: top }
    case 'setFocusKey':
      if (top.focusKey === action.focusKey) return state
      return {
        ...state,
        stack: [...state.stack.slice(0, -1), { ...top, focusKey: action.focusKey }],
      }
  }
}

export interface Pages {
  /** the player, always at the bottom */
  root: PageEntry
  current: PageEntry
  previous: PageEntry | null
  depth: number
  push: (id: PageId) => void
  /** false on the root, which never pops */
  pop: () => boolean
  /** back to the root */
  reset: () => void
  /** saves the focus on the current page */
  setFocusKey: (focusKey: string) => void
}

/** The page stack. The overlays sit above it and are `useOverlays`' business. */
export function usePages(): Pages {
  const [state, setState] = useState(initialPages)
  // every action reads this, so two presses in one tick see each other
  const latest = useRef(state)

  const apply = useCallback((action: PagesAction) => {
    const next = pagesReducer(latest.current, action)
    if (next === latest.current) return false
    latest.current = next
    setState(next)
    return true
  }, [])

  const push = useCallback((id: PageId) => void apply({ type: 'push', id }), [apply])
  const pop = useCallback(() => apply({ type: 'pop' }), [apply])
  const reset = useCallback(() => void apply({ type: 'reset' }), [apply])
  const setFocusKey = useCallback(
    (focusKey: string) => void apply({ type: 'setFocusKey', focusKey }),
    [apply],
  )

  const { stack, previous } = state
  return useMemo(
    () => ({
      root: stack[0],
      current: stack[stack.length - 1],
      previous,
      depth: stack.length,
      push,
      pop,
      reset,
      setFocusKey,
    }),
    [stack, previous, push, pop, reset, setFocusKey],
  )
}
