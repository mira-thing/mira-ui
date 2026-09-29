import { createContext, useContext } from 'react'
import type { BannerVariant, BannerIcon } from '@/components/TopBanner'

export interface NotifyOptions {
  variant?: BannerVariant
  icon?: BannerIcon
  deviceType?: string
  durationMs?: number
}

export type NotifyFn = (message: string, opts?: NotifyOptions) => void

export const NotifyContext = createContext<NotifyFn>(() => {})

export const OverlayActivityContext = createContext({
  volumeVisible: false,
  notificationVisible: false,
  setVolumeVisible: (_visible: boolean) => {
    void _visible
  },
})

export function useOverlayActivity() {
  return useContext(OverlayActivityContext)
}

// any component can use the banner
export function useNotify(): NotifyFn {
  return useContext(NotifyContext)
}
