import { useEffect } from 'react'
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

  useEffect(() => {
    if (!playing || settingUp || shown()) return
    const t = window.setTimeout(() => {
      if (!shown()) onShow()
    }, SPONSOR_AFTER_PLAY_MS)
    return () => window.clearTimeout(t)
  }, [playing, settingUp, shown, onShow])
}
