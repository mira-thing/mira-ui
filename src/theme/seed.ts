import {
  backgroundDepthColor,
  groundTone,
  surfaceGlowColor,
  surfaceTintColor,
  type GroundRole,
  type RGB,
} from '@/hooks/useColorExtract'

export interface ThemeRoles {
  /** glass surfaces, at each surface's own alpha */
  tint: RGB
  /** the bloom behind the cover */
  glow: RGB
  /** the shade over the background between the player's panels */
  depth: RGB
  /** one colour per ambient orb */
  ground: Record<GroundRole, RGB>
}

const BLACK: RGB = [0, 0, 0]

/**
 * Nothing is playing with art: the screensaver's black ground and green glow, with no orbs
 * and a transparent surface tint. The look itself is painted by AmbientGround and Surface.
 */
export const IDLE_ROLES: ThemeRoles = {
  tint: BLACK,
  glow: [30, 215, 96],
  depth: BLACK,
  ground: { deep: BLACK, base: BLACK, hot: BLACK },
}

/** The album's roles, from its palette (the accent first). An empty palette is the idle look. */
export function deriveRoles(palette: RGB[]): ThemeRoles {
  if (palette.length === 0) return IDLE_ROLES
  const first = palette[0]
  const second = palette[1] ?? first
  const third = palette[2] ?? second
  return {
    tint: surfaceTintColor(first),
    glow: surfaceGlowColor(first),
    depth: backgroundDepthColor(first),
    ground: {
      deep: groundTone(second, 'deep'),
      base: groundTone(first, 'base'),
      hot: groundTone(third, 'hot'),
    },
  }
}
