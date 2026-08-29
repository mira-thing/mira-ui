import { useEffect, useState } from 'react'

/**
 * False until `active` has held true for `ms`, then true. Drops back to false
 * the moment `active` does, and restarts the wait when `resetKey` changes.
 *
 * For "we have been stuck in this state long enough to say something about it"
 * timers: a boot that never finds the network, an offline holdoff, a splash
 * waiting on Spotify.
 */
export function useDelayedFlag(active: boolean, ms: number, resetKey?: string): boolean {
  const [elapsed, setElapsed] = useState(false)

  // re-arm during render rather than from an effect, so a restart costs no
  // extra pass and a stale `true` can never reach a consumer
  const wait = `${active}|${ms}|${resetKey ?? ''}`
  const [armed, setArmed] = useState(wait)
  if (armed !== wait) {
    setArmed(wait)
    setElapsed(false)
  }

  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => setElapsed(true), ms)
    return () => window.clearTimeout(t)
  }, [active, ms, resetKey])

  return elapsed && active
}
