import { useEffect, useState } from 'react'
import type { ObserverStatus } from '@/api/types'

const UTC_OFFSET_KEY = 'mira.utcOffsetMin'

/**
 * Minutes from UTC, as resolved by the daemon and remembered across boots.
 * The device has no clock of its own, so the screensaver would otherwise show
 * the wrong time for however long the daemon takes to answer after a restart.
 */
export function useUtcOffset(status: ObserverStatus | null): number | null {
  const [offsetMin, setOffsetMin] = useState<number | null>(() => {
    try {
      const stored = window.localStorage.getItem(UTC_OFFSET_KEY)
      return stored == null ? null : Number(stored)
    } catch {
      return null
    }
  })

  const reported = status?.utc_offset_min
  useEffect(() => {
    if (typeof reported !== 'number') return
    setOffsetMin(reported)
    try {
      window.localStorage.setItem(UTC_OFFSET_KEY, String(reported))
    } catch {
      // ignore
    }
  }, [reported])

  return offsetMin
}
