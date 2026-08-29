import { useEffect } from 'react'

// discoverability lapses if left alone; BluetoothMenu re-asserts on the same
// interval while in pair mode
const REASSERT_MS = 3000

export interface UseDiscoverableWhilePairingParams {
  /** a screen is up that expects a phone to be able to find us */
  pairingScreenShown: boolean
  /** the Bluetooth menu manages discoverability itself; stay out of its way */
  btMenuOpen: boolean
  setDiscoverable: (enable: boolean) => Promise<void>
}

/**
 * Keeps the device discoverable for as long as a pairing screen is up, and
 * turns it off again the moment one isn't. The re-assert is load-bearing, not
 * a stray poll: discoverability does not hold on its own, and a user who opens
 * this screen and goes to fetch their phone has to still be findable when they
 * get back.
 */
export function useDiscoverableWhilePairing({
  pairingScreenShown,
  btMenuOpen,
  setDiscoverable,
}: UseDiscoverableWhilePairingParams): void {
  useEffect(() => {
    if (btMenuOpen) return
    if (!pairingScreenShown) {
      void setDiscoverable(false).catch(() => {})
      return
    }
    let cancelled = false
    const assertOn = () => {
      if (!cancelled) void setDiscoverable(true).catch(() => {})
    }
    assertOn()
    const id = window.setInterval(assertOn, REASSERT_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pairingScreenShown, btMenuOpen, setDiscoverable])
}
