import { useEffect, useRef, useState } from 'react'
import { displayNow, msToNextMinute, sameMinute } from '@/utils/clock'

// the device sets its clock from NTP after boot, and a pending timer never sees that jump
const CHECK_MS = 1000

/**
 * The wall time from `displayNow`, re-rendering only when the minute changes: at the boundary,
 * or within a second of the clock jumping. Only the caller re-renders, so keep it in a leaf.
 */
export function useMinuteClock(utcOffsetMin: number | null | undefined): Date {
  const [now, setNow] = useState(() => displayNow(utcOffsetMin))
  const shown = useRef(now)

  useEffect(() => {
    let timer = 0
    const tick = () => {
      const next = displayNow(utcOffsetMin)
      if (!sameMinute(shown.current, next)) {
        shown.current = next
        setNow(next)
      }
      timer = window.setTimeout(tick, Math.min(CHECK_MS, msToNextMinute(Date.now())))
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [utcOffsetMin])

  return now
}
