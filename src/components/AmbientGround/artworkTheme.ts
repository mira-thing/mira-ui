import { createContext, useContext, useMemo, type CSSProperties } from 'react'
import { surfaceGlowColor, surfaceTintColor, type RGB } from '@/hooks/useColorExtract'

const FALLBACK: RGB = [45, 50, 61]
const FALLBACK_PALETTE: RGB[] = [FALLBACK, [51, 43, 61]]
export const ArtworkPaletteContext = createContext<RGB[]>(FALLBACK_PALETTE)

export function useArtworkSurface(tone = 0, strength = 0.4): CSSProperties {
  const palette = useContext(ArtworkPaletteContext)
  return useMemo(() => {
    const source = palette[tone] ?? palette[0] ?? FALLBACK
    const tint = surfaceTintColor(source)
    const glow = surfaceGlowColor(source)
    return {
      '--surface-tint': `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${strength})`,
      '--surface-glow': `rgb(${glow[0]}, ${glow[1]}, ${glow[2]})`,
    } as CSSProperties
  }, [palette, tone, strength])
}
