import { useSyncExternalStore } from 'react'
import {
  getSettings,
  subscribeSettings,
  UI_SCALE_DEFAULT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
} from '@/settings'

// the panel is a fixed 800x480 and every dimension in the app is a compile-time px
// constant, so "display size" works by sizing #root to a *logical* viewport and zooming
// it back onto the physical panel. zoom reflows AND rasterizes at the final size, so
// text stays crisp at every notch (transform:scale stretched the finished raster).
//
// scale > 1 => smaller logical viewport => bigger ui, less content on screen.
//
// chrome 69 under zoom: rects are unzoomed layout px, pointer coords and wheel deltas
// device px divide the latter by getUiScale() before mixing with rects

const BASE_W = 800
const BASE_H = 480

// the album art is the only fixed height block in the player column, so it gives way first
//   stage row = h - (pad-y 12 + pad-bottom 12 + row gap 12 + bottom bar 144)
//   .left     = panel padding 16x2 + border 1x2 (34) + art gap 12 + compact TrackInfo 52
const STAGE_RESERVED_H = 180
const ART_MAX = 200
const ART_MIN = 120
const ART_RESERVED_H = STAGE_RESERVED_H + 34 + 12 + 52

// 264px cover at 100%
const HERO_ART_MAX = 264
// the no-lyrics panel only adds its padding and border around the cover
const HERO_RESERVED_H = STAGE_RESERVED_H + 34

// whole pixels keep layout off subpixels; zoom derives from the rounded width so the
// paint lands on exactly 800 wide, and h ceils so the bottom overshoots by <1px
// (clipped) instead of leaving a seam
export function logicalSize(pct: number): { w: number; h: number } {
  const s = pct / 100
  const w = Math.round(BASE_W / s)
  const z = BASE_W / w
  return { w, h: Math.ceil(BASE_H / z) }
}

export function artSizeFor(pct: number): number {
  const { h } = logicalSize(pct)
  return Math.max(ART_MIN, Math.min(ART_MAX, Math.floor(h - ART_RESERVED_H)))
}

// keeps the cover inside the padded panel at every display-size notch
export function heroArtSizeFor(pct: number): number {
  return Math.max(ART_MIN, Math.min(HERO_ART_MAX, Math.floor(logicalSize(pct).h - HERO_RESERVED_H)))
}

let achievedX = 1
let achievedY = 1
const listeners = new Set<() => void>()

// coerce() only runs when settings are loaded; updateSettings is a raw spread, so a bad
// value can reach here at runtime. a NaN would render as "NaNpx" (silently dropped by
// CSSOM) and then poison every consumer of getUiScale, freezing the lyrics for good
function safePct(pct: number): number {
  if (!Number.isFinite(pct)) return UI_SCALE_DEFAULT
  return Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, pct))
}

export function applyUiScale(pct: number): void {
  const { w, h } = logicalSize(safePct(pct))
  const z = BASE_W / w

  // absent under jsdom, where testing-library mounts into its own container
  const el = document.getElementById('root')
  if (el) {
    achievedX = z
    achievedY = z
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    // always assign, never skip: coming back down to 100 has to actively clear a
    // previous zoom or the ui stays magnified with its width snapped back
    el.style.setProperty('zoom', z === 1 ? '' : String(z))
    el.style.transform = ''
    el.style.transformOrigin = ''
  }

  for (const l of listeners) l()
}

// the zoom actually applied to the dom divide device-space coords and deltas by it.
// not identical to pct/100 because of the width rounding above
export function getUiScale(): number {
  return achievedX
}

export function getUiScaleY(): number {
  return achievedY
}

// applies the stored scale and keeps it in sync. call before the first render: settings
// read localStorage synchronously at module init, so there's no flash of unscaled ui
export function startUiScaleSync(): () => void {
  let applied = getSettings().uiScalePct
  applyUiScale(applied)
  return subscribeSettings(() => {
    const pct = getSettings().uiScalePct
    // the store emits on every patch. rewriting #root's width invalidates layout for the
    // whole tree, so don't do it on every brightness notch
    if (pct === applied) return
    applied = pct
    applyUiScale(pct)
  })
}

// hoisted so useSyncExternalStore doesn't resubscribe on every render of every consumer
function subscribeUiScale(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// separate from the settings store on purpose: components that only care about the
// scale shouldn't re-render when the brightness or lyric offset changes
export function useUiScale(): number {
  return useSyncExternalStore(subscribeUiScale, getUiScale)
}
