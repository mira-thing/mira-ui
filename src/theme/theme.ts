import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useArtworkColors, type RGB } from '@/hooks/useColorExtract'
import { deriveRoles, IDLE_ROLES, type ThemeRoles } from './seed'

export type ThemeSource = 'album' | 'idle'

export interface Theme {
  source: ThemeSource
  /** the album's palette, accent first; empty when idle */
  palette: RGB[]
  roles: ThemeRoles
}

export interface ThemeInput {
  /** the presented art, so `presentTrack(...).art` */
  art?: string
  /** the DJ is talking: its art is blank, but the album's colours stay */
  narrating?: boolean
}

const NO_PALETTE: RGB[] = []
// a recolour restyles every node on Chrome 69, so a new track's cover and title paint first
const RECOLOR_LAG_MS = 300
export const IDLE_THEME: Theme = { source: 'idle', palette: NO_PALETTE, roles: IDLE_ROLES }

export const ThemeContext = createContext<Theme>(IDLE_THEME)

export function useTheme(): Theme {
  return useContext(ThemeContext)
}

/**
 * The album look while there is art, idle when there is none. The last album palette is
 * held while the DJ talks and while the next cover is still being sampled. One album gives way
 * to the next a beat after its cover shows.
 */
export function useThemeSource({ art, narrating = false }: ThemeInput): Theme {
  const { palette, pending } = useArtworkColors(art || undefined)
  const [held, setHeld] = useState<RGB[] | null>(palette)
  const shown = palette ?? (narrating || pending ? held : null)
  if (shown !== held) setHeld(shown)
  const [applied, setApplied] = useState(shown)
  const lagging = !!(shown && applied && shown !== applied)
  if (shown !== applied && !lagging) setApplied(shown)
  useEffect(() => {
    if (!lagging) return
    const timer = window.setTimeout(() => setApplied(shown), RECOLOR_LAG_MS)
    return () => window.clearTimeout(timer)
  }, [lagging, shown])
  return useMemo(
    () =>
      applied ? { source: 'album', palette: applied, roles: deriveRoles(applied) } : IDLE_THEME,
    [applied],
  )
}

function triplet([r, g, b]: RGB): string {
  return `${r}, ${g}, ${b}`
}

/** Written on each surface, as a triplet so its styles can write `rgba(var(--theme-tint), a)`. */
export function tintVar({ roles }: Theme): CSSProperties {
  return { '--theme-tint': triplet(roles.tint) } as CSSProperties
}

/** Written on a surface that shows on states, for `rgb(var(--theme-accent))` */
export function accentVar({ roles }: Theme): CSSProperties {
  return { '--theme-accent': triplet(roles.accent) } as CSSProperties
}

/** The fill of the player's background depth shade. */
export function depthFill({ roles }: Theme): string {
  return `rgb(${triplet(roles.depth)})`
}
