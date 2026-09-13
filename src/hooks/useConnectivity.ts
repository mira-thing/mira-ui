import { useState } from 'react'
import { useBluetooth, type BtTroubleHint, type Carriers, type PairingPrompt } from './useBluetooth'
import { useKnownDevices } from './useKnownDevices'
import type { KnownBluetoothDevice } from '@/api/types'

export interface Connectivity {
  /** null until the daemon has said either way */
  online: boolean | null
  /** which physical links are up */
  carriers: Carriers | null
  pairing: PairingPrompt | null
  trouble: BtTroubleHint
  setDiscoverable: (enable: boolean) => Promise<void>
  /** any phone has been paired, whether or not it is here now */
  hasKnownDevice: boolean
  btConnectedDevice: KnownBluetoothDevice | null
  topKnownDeviceName: string | null
  /** latched: separates first-time setup from a connection that dropped */
  wasOnline: boolean
}

/**
 * Everything the screens need to know about reaching the outside world,
 * gathered from bluetooth and the paired-device list. Reports state only —
 * which screen that state calls for is `resolveOfflineScreen`'s job.
 */
export function useConnectivity(): Connectivity {
  const { online, carriers, pairing, trouble, setDiscoverable } = useBluetooth()
  const { devices: knownDevices } = useKnownDevices(true)

  const [wasOnline, setWasOnline] = useState(false)
  if (online === true && !wasOnline) setWasOnline(true)

  return {
    online,
    carriers,
    pairing,
    trouble,
    setDiscoverable,
    hasKnownDevice: (knownDevices?.length ?? 0) > 0,
    btConnectedDevice: knownDevices?.find((d) => d.connected) ?? null,
    topKnownDeviceName: knownDevices?.[0]?.name ?? null,
    wasOnline,
  }
}
