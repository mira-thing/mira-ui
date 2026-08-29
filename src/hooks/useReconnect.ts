import { useState } from 'react'
import type { ObserverStatus, ObserverStatusActive } from '@/api/types'
import type { ReconnectReason } from '@/components/ReconnectBanner'

/**
 * The last status that had a device playing. The player renders from this
 * through a short drop so lyrics scroll, marquee, and art crossfade survive
 * a reconnect instead of remounting.
 */
export function useHeldStatus(status: ObserverStatus | null): ObserverStatusActive | null {
  const [held, setHeld] = useState<ObserverStatusActive | null>(null)
  // captured during render rather than from an effect, so the player never
  // paints a frame on the previous track after a status arrives
  if (status?.active && status !== held) setHeld(status)
  return status?.active ? status : held
}

export interface DropInput {
  /** dev screens supply their own status, so real drop detection stands down */
  suppressed: boolean
  held: ObserverStatusActive | null
  status: ObserverStatus | null
  online: boolean | null
  /** the /events websocket */
  connected: boolean
}

/**
 * Why playback stopped while the phone is still reachable, or null if this
 * isn't a drop we expect to recover from. Only meaningful once something has
 * played: with no held status there is nothing to reconnect to.
 */
export function resolveDropReason({
  suppressed,
  held,
  status,
  online,
  connected,
}: DropInput): ReconnectReason | null {
  if (suppressed || !held || status?.active === true || online !== true) return null
  if (!connected) return 'ws'
  if (status && !status.active && status.message === 'starting up') return 'dealer'
  return null
}
