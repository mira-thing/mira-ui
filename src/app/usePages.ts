import { useCallback, useMemo, useRef, useState } from 'react'

/** Each page's params, `undefined` for a page that takes none. Add a page here first. */
export interface PageParams {
  home: undefined
  player: undefined
  playlists: undefined
  queue: undefined
  'ui-kit': undefined
}

export type PageId = keyof PageParams

/** One `{ id, params }` per page in `M`, with `params` required only where the page takes some. */
export type RouteOf<M> = {
  [Id in keyof M & string]: M[Id] extends undefined
    ? { id: Id; params?: undefined }
    : { id: Id; params: M[Id] }
}[keyof M & string]

/** What `push` takes: `{ id: 'queue' }`, or `{ id, params }` for a page with params. */
export type PageRoute = RouteOf<PageParams>

export interface BaseRoute {
  id: string
  params?: unknown
}

export type PageEntry<R extends BaseRoute = PageRoute> = R & {
  /** unique per push, so a page pushed twice mounts twice */
  key: number
  /** what had focus on the page, restored when it is uncovered */
  focusKey?: string
}

export interface PagesState<R extends BaseRoute = PageRoute> {
  /** never empty; the root is always at the bottom */
  stack: readonly PageEntry<R>[]
  /** the entry that last left the top, for the shell to animate out; null after a silent change */
  previous: PageEntry<R> | null
  nextKey: number
}

export type PagesAction<R extends BaseRoute = PageRoute> =
  /** `silent` swaps the top in without a transition, e.g. when the shell is only now appearing */
  | { type: 'push'; route: R; silent?: boolean }
  | { type: 'pop' }
  | { type: 'reset' }
  /** takes every entry with this id out of the stack; one on top leaves as a pop would */
  | { type: 'drop'; id: R['id'] }
  | { type: 'setFocusKey'; focusKey: string }

export function initialPagesFor<R extends BaseRoute>(root: R): PagesState<R> {
  return { stack: [{ ...root, key: 0 }], previous: null, nextKey: 1 }
}

export const initialPages: PagesState = initialPagesFor<PageRoute>({ id: 'home' })

/** Returns `state` itself when the action changes nothing. */
export function pagesReducer<R extends BaseRoute>(
  state: PagesState<R>,
  action: PagesAction<R>,
): PagesState<R> {
  const top = state.stack[state.stack.length - 1]
  switch (action.type) {
    case 'push':
      return {
        stack: [...state.stack, { ...action.route, key: state.nextKey }],
        previous: action.silent ? null : top,
        nextKey: state.nextKey + 1,
      }
    case 'pop':
      if (state.stack.length === 1) return state
      return { ...state, stack: state.stack.slice(0, -1), previous: top }
    case 'reset':
      if (state.stack.length === 1) return state
      return { ...state, stack: state.stack.slice(0, 1), previous: top }
    case 'drop': {
      const [root, ...rest] = state.stack
      const kept = rest.filter((e) => e.id !== action.id)
      if (kept.length === rest.length) return state
      return {
        ...state,
        stack: [root, ...kept],
        previous: top.id === action.id ? top : state.previous,
      }
    }
    case 'setFocusKey':
      if (top.focusKey === action.focusKey) return state
      return {
        ...state,
        stack: [...state.stack.slice(0, -1), { ...top, focusKey: action.focusKey }],
      }
  }
}

export interface Pages {
  /** the bottom of the stack, which never pops */
  root: PageEntry
  current: PageEntry
  previous: PageEntry | null
  depth: number
  push: (route: PageRoute, opts?: { silent?: boolean }) => void
  /** false on the root, which never pops */
  pop: () => boolean
  /** back to the root */
  reset: () => void
  /** takes a page out wherever it sits; see the `drop` action */
  drop: (id: PageId) => void
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

  const push = useCallback(
    (route: PageRoute, opts?: { silent?: boolean }) =>
      void apply({ type: 'push', route, silent: opts?.silent }),
    [apply],
  )
  const pop = useCallback(() => apply({ type: 'pop' }), [apply])
  const reset = useCallback(() => void apply({ type: 'reset' }), [apply])
  const drop = useCallback((id: PageId) => void apply({ type: 'drop', id }), [apply])
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
      drop,
      setFocusKey,
    }),
    [stack, previous, push, pop, reset, drop, setFocusKey],
  )
}
