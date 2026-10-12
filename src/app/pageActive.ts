import { createContext, useContext } from 'react'

// true outside a shell, so a page rendered on its own behaves as the current one
export const PageActiveContext = createContext(true)

/** False while the page is animating out under the one replacing it. */
export function usePageActive(): boolean {
  return useContext(PageActiveContext)
}
