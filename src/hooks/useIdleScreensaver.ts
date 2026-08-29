import { useEffect } from 'react'
import type { ObserverStatus } from '@/api/types'
import type { ScreensaverBy } from './useOverlays'

/** ten quiet minutes. Not a setting on purpose. */
export const SCREENSAVER_AUTO_MS = 10 * 60 * 1000

/** input that decides the idle timer runs at all */
export interface IdleEligibility {
  /** the screensaver is already up */
  open: boolean
  /** anything else owns the screen: an overlay, a dev screen, a drop, auth */
  busy: boolean
  /** neither counts as busy, but neither wants a screensaver over it either */
  consentOpen: boolean
  updateCardOpen: boolean
  loading: boolean
  status: ObserverStatus | null
}

/**
 * The screensaver may only take over from a settled idle screen — never from
 * a boot, a setup, a card waiting on an answer, or anything playing.
 */
export function idleScreensaverEligible(input: IdleEligibility): boolean {
  const { open, busy, consentOpen, updateCardOpen, loading, status } = input
  if (open || busy || consentOpen || updateCardOpen || loading) return false
  return status != null && status.active !== true && status.setting_up !== true
}

export interface UseIdleScreensaverParams extends IdleEligibility {
  openedBy: ScreensaverBy
  onOpen: () => void
  onClose: () => void
}

const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const

/**
 * Opens the screensaver after SCREENSAVER_AUTO_MS of no input on the idle
 * screen, and closes it again when playback starts. Only an auto-opened one
 * yields like that: a manual one is desk mode and stays put, cross-fading its
 * art instead.
 */
export function useIdleScreensaver(params: UseIdleScreensaverParams): void {
  const { open, openedBy, onOpen, onClose, status } = params
  const eligible = idleScreensaverEligible(params)

  useEffect(() => {
    if (!eligible) return

    let timer = window.setTimeout(onOpen, SCREENSAVER_AUTO_MS)
    const restart = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(onOpen, SCREENSAVER_AUTO_MS)
    }
    // capture, so a handler that stops propagation cannot look like quiet
    for (const name of INPUT_EVENTS) {
      window.addEventListener(name, restart, { capture: true })
    }
    return () => {
      window.clearTimeout(timer)
      for (const name of INPUT_EVENTS) {
        window.removeEventListener(name, restart, { capture: true })
      }
    }
  }, [eligible, onOpen])

  const playing = status?.active === true
  useEffect(() => {
    if (open && openedBy === 'auto' && playing) onClose()
  }, [open, openedBy, playing, onClose])
}
