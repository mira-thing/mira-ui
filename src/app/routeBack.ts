import { createContext, useContext, useEffect, useEffectEvent, useState } from 'react'
import { usePageActive } from './pageActive'

// a handler returns true when it consumed the press
export type BackHandler = () => boolean

export interface RouteBack {
  /** `order` ranks it, highest first; without one it outranks every handler so far */
  register: (handler: BackHandler, order?: number) => () => void
  /** a rank above every one handed out so far */
  nextOrder: () => number
  /** offers the press to the highest-ranked handler first; false when none took it */
  run: () => boolean
}

export function createRouteBack(): RouteBack {
  // ascending by order, so the press walks it from the end
  const handlers: { handler: BackHandler; order: number }[] = []
  let lastOrder = 0
  const nextOrder = () => ++lastOrder
  return {
    register(handler, order = nextOrder()) {
      const entry = { handler, order }
      const at = handlers.findIndex((h) => h.order > order)
      handlers.splice(at < 0 ? handlers.length : at, 0, entry)
      return () => {
        const i = handlers.indexOf(entry)
        if (i >= 0) handlers.splice(i, 1)
      }
    },
    nextOrder,
    run() {
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i].handler()) return true
      }
      return false
    },
  }
}

export const RouteBackContext = createContext<RouteBack | null>(null)

/**
 * Lets a page take the back button before the stack pops it, e.g. to leave a sub-view.
 * Ranked by first render, which runs parent before child, so the innermost handler goes first.
 */
export function useRouteBack(onBack: BackHandler): void {
  const routeBack = useContext(RouteBackContext)
  const active = usePageActive()
  const [order] = useState(() => routeBack?.nextOrder() ?? 0)
  const back = useEffectEvent(onBack)
  useEffect(() => {
    if (!routeBack || !active) return
    return routeBack.register(() => back(), order)
  }, [routeBack, active, order])
}
