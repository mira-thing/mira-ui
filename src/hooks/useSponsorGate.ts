import { useEffect, useEffectEvent } from 'react'
import type { ObserverStatus } from '@/api/types'

/** long enough that the thing is clearly working before we ask for anything */
export const SPONSOR_AFTER_PLAY_MS = 3 * 60 * 1000

export interface UseSponsorGateParams {
  status: ObserverStatus | null
  /** already shown, on this boot or an earlier one */
  shown: () => boolean
  onShow: () => void
}

/**
 * Shows the sponsor screen once, ever, and only after three unbroken minutes
 * of playback — so the ask lands on someone whose device is working, not on
 * someone still setting it up or watching a boot splash.
 */
export function useSponsorGate({ status, shown, onShow }: UseSponsorGateParams): void {
  const playing = status?.active === true
  const settingUp = status?.setting_up === true

  // effect events, so the callers' identities stay out of the dep array below:
  // a caller that rebuilds them on every overlay open would restart the timer
  const isShown = useEffectEvent(() => shown())
  const show = useEffectEvent(() => onShow())

  useEffect(() => {
    if (!playing || settingUp || isShown()) return
    const t = window.setTimeout(() => {
      if (!isShown()) show()
    }, SPONSOR_AFTER_PLAY_MS)
    return () => window.clearTimeout(t)
  }, [playing, settingUp])
}
