import { createContext, useContext } from 'react'
import type { PageId } from '@/app/usePages'

export const DEV_SCREENS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEV_SCREENS === '1'

export type DevForcedScreen =
  | null
  | 'connection-chooser'
  | 'pc-connect'
  | 'needs-network'
  | 'starting'
  | 'setting-up'
  | 'boot-splash'
  | 'auth'
  | 'idle'
  | 'playing-lyrics'
  | 'playing-no-lyrics'
  | 'pairing'
  | 'menu'
  | 'power-menu'
  | 'bluetooth-menu'
  | 'settings'
  | 'reconnecting'
  | 'no-internet'
  | 'checking'
  | 'reconnect-banner'
  | 'debug'
  | 'sponsor'
  | 'screensaver'
  | 'consent'
  | 'update-card'

// dev screens that are a page in the stack, rendered over the mock status
const FORCED_PAGES: Partial<Record<Exclude<DevForcedScreen, null>, PageId>> = {}

export function forcedPageOf(forced: DevForcedScreen): PageId | null {
  return (forced && FORCED_PAGES[forced]) ?? null
}

export interface DevScreenCtx {
  forced: DevForcedScreen
  setForced: (s: DevForcedScreen) => void
}

export const DevScreenContext = createContext<DevScreenCtx>({
  forced: null,
  setForced: () => {},
})

export function useDevScreen(): DevScreenCtx {
  return useContext(DevScreenContext)
}
