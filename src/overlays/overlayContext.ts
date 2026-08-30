import { createContext, useContext } from 'react'
import type { Overlays } from '@/hooks/useOverlays'

const MISSING = 'useOverlayState called outside an OverlayProvider'

export const OverlayContext = createContext<Overlays | null>(null)

/**
 * The overlay stack, for anything that opens, closes, or renders one. Throws
 * rather than defaulting: an overlay that silently does nothing is worse to
 * debug than a component that refuses to mount.
 */
export function useOverlayState(): Overlays {
  const overlays = useContext(OverlayContext)
  if (overlays === null) throw new Error(MISSING)
  return overlays
}
