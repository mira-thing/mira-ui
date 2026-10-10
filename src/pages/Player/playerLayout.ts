import { SURFACE_INSET } from '@/theme/metrics'
import { logicalSize } from '@/uiScale'

// the album art is the only fixed height block in the player column, so it gives way first
//   stage row = h - (pad-y 12 + pad-bottom 12 + row gap 12 + bottom bar 144)
//   .left     = surface inset (padding + border, both sides) + art gap 12 + compact TrackInfo 52
const STAGE_RESERVED_H = 180
const ART_MAX = 200
const ART_MIN = 120
const ART_RESERVED_H = STAGE_RESERVED_H + SURFACE_INSET + 12 + 52

// 264px cover at 100%
const HERO_ART_MAX = 264
// the no-lyrics panel only adds its padding and border around the cover
const HERO_RESERVED_H = STAGE_RESERVED_H + SURFACE_INSET

export function artSizeFor(pct: number): number {
  const { h } = logicalSize(pct)
  return Math.max(ART_MIN, Math.min(ART_MAX, Math.floor(h - ART_RESERVED_H)))
}

// keeps the cover inside the padded panel at every display-size notch
export function heroArtSizeFor(pct: number): number {
  return Math.max(ART_MIN, Math.min(HERO_ART_MAX, Math.floor(logicalSize(pct).h - HERO_RESERVED_H)))
}
