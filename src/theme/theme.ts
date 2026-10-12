import { createContext, useContext, useMemo, useState, type CSSProperties } from 'react'
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
export const IDLE_THEME: Theme = { source: 'idle', palette: NO_PALETTE, roles: IDLE_ROLES }

export const ThemeContext = createContext<Theme>(IDLE_THEME)

export function useTheme(): Theme {
  return useContext(ThemeContext)
}

/**
 * The album look while there is art, idle when there is none. The last album palette is
 * held while the DJ talks and while the next cover is still being sampled.
 */
export function useThemeSource({ art, narrating = false }: ThemeInput): Theme {
  const { palette, pending } = useArtworkColors(art || undefined)
  const [held, setHeld] = useState<RGB[] | null>(palette)
  const shown = palette ?? (narrating || pending ? held : null)
  if (shown !== held) setHeld(shown)
  return useMemo(
    () => (shown ? { source: 'album', palette: shown, roles: deriveRoles(shown) } : IDLE_THEME),
    [shown],
  )
}

function triplet([r, g, b]: RGB): string {
  return `${r}, ${g}, ${b}`
}

/** Written on the themed root, as triplets so a surface can write `rgba(var(--theme-tint), a)`. */
export function themeVars({ roles }: Theme): CSSProperties {
  return {
    '--theme-tint': triplet(roles.tint),
    '--theme-glow': triplet(roles.glow),
    '--theme-depth': triplet(roles.depth),
  } as CSSProperties
}
