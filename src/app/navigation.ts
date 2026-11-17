import { createContext, useContext } from 'react'
import type { PageRoute } from './usePages'

/** What a page may do to the stack it sits in. */
export interface Navigation {
  push: (route: PageRoute) => void
  /** false on the root, which never pops */
  pop: () => boolean
  /** back to the root */
  reset: () => void
}

export const NavigationContext = createContext<Navigation | null>(null)

/** The page stack's controls; throws outside one, since a page that navigates needs a stack. */
export function useNavigation(): Navigation {
  const nav = useContext(NavigationContext)
  if (!nav) throw new Error('useNavigation: no NavigationContext above this page')
  return nav
}
