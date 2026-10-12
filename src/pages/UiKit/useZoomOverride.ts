import { useEffect } from 'react'
import { getSettings } from '@/settings'
import { applyUiScale, useUiScale } from '@/uiScale'

const ZOOM_NOTCHES = [85, 100, 115] as const

/** The notches, plus the applied zoom when the settings slider left it between them. */
export function zoomOptions(current: number): number[] {
  const notches: number[] = [...ZOOM_NOTCHES]
  return notches.includes(current) ? notches : [...notches, current].sort((a, b) => a - b)
}

/**
 * The zoom applied right now, in percent, and a setter that applies one without saving it.
 * The saved zoom is put back on unmount.
 */
export function useZoomOverride(): [number, (pct: number) => void] {
  const pct = Math.round(useUiScale() * 100)
  useEffect(() => () => applyUiScale(getSettings().uiScalePct), [])
  return [pct, applyUiScale]
}
