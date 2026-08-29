import { useMemo, useState } from 'react'
import { useDelayedFlag } from './useDelayedFlag'
import type { Carriers } from './useBluetooth'
import type { OfflineScreen } from '@/app/routes'
import type { KnownBluetoothDevice, ObserverStatusActive } from '@/api/types'

const OFFLINE_GRACE_MS = 6000
const OFFLINE_HOLDOFF_MS = 10000

/** how the user chose to get back online, once we stop guessing for them */
export type OfflineMethod = 'chooser' | 'bluetooth' | 'pc'

export interface OfflineScreenInput {
  active: boolean
  /** still worth a "checking connection" rather than a verdict */
  checking: boolean
  btConnected: boolean
  hasKnownDevice: boolean
  wasOnline: boolean
  /** the user asked for the chooser instead of whatever we picked */
  setupOverride: boolean
  method: OfflineMethod
}

export function resolveOfflineScreen(input: OfflineScreenInput): OfflineScreen | null {
  if (!input.active) return null
  if (input.checking) return 'checking'
  if (input.setupOverride) return input.method
  // the phone is here but carrying no internet -> ask for tethering
  if (input.btConnected) return 'tethering'
  if (input.hasKnownDevice || input.wasOnline) return 'reconnecting'
  return input.method
}

export interface UseOfflineScreenParams {
  /** a dev screen is driving; stay out of the way */
  suppressed: boolean
  online: boolean | null
  carriers: Carriers | null
  btConnectedDevice: KnownBluetoothDevice | null
  hasKnownDevice: boolean
  wasOnline: boolean
  heldStatus: ObserverStatusActive | null
  bootStuck: boolean
  reconnecting: boolean
}

export interface OfflineState {
  screen: OfflineScreen | null
  /** the offline flow owns the display, so back gestures belong to it */
  active: boolean
  method: OfflineMethod
  setMethod: (method: OfflineMethod) => void
  setupOverride: boolean
  setSetupOverride: (override: boolean) => void
}

/**
 * Decides whether we are offline enough to say so, and which of the recovery
 * screens to show. Deliberately slow to accuse: a link that is still coming up
 * gets a grace period, and a connection that has worked before gets a holdoff,
 * so a two-second blip never throws the user into setup.
 */
export function useOfflineScreen(params: UseOfflineScreenParams): OfflineState {
  const {
    suppressed,
    online,
    carriers,
    btConnectedDevice,
    hasKnownDevice,
    wasOnline,
    heldStatus,
    bootStuck,
    reconnecting,
  } = params

  const [method, setMethod] = useState<OfflineMethod>('chooser')
  const [setupOverride, setSetupOverride] = useState(false)
  // the override is a detour, not a preference; getting back online ends it
  if (online === true && setupOverride) setSetupOverride(false)

  const connecting =
    online === false && (carriers?.bt === true || btConnectedDevice != null || heldStatus != null)
  // every new milestone — a carrier came up, a device bonded, a status arrived —
  // buys another grace period before we call it
  const milestone = `${carriers?.bt === true}|${btConnectedDevice?.address ?? ''}|${heldStatus != null}`
  const graceElapsed = useDelayedFlag(connecting, OFFLINE_GRACE_MS, milestone)
  const offlineHeld = useDelayedFlag(online === false, OFFLINE_HOLDOFF_MS)

  // a connection that has worked before earns the holdoff; a first boot does not
  const confirmed = online === false && (offlineHeld || !wasOnline)
  const active = !suppressed && !reconnecting && (confirmed || (bootStuck && online !== true))

  const screen = resolveOfflineScreen({
    active,
    checking: active && connecting && !graceElapsed,
    btConnected: btConnectedDevice != null,
    hasKnownDevice,
    wasOnline,
    setupOverride,
    method,
  })

  // stable identity: the back handler depends on this, and an unstable one
  // would tear down the hardware key listeners on every render
  return useMemo(
    () => ({ screen, active, method, setMethod, setupOverride, setSetupOverride }),
    [screen, active, method, setupOverride],
  )
}
