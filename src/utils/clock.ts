const MINUTE_MS = 60_000

// chrome 69 on the device has no locale data, so toLocaleDateString ignores the format options
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The wall time to show: `utcOffsetMin` minutes from UTC, or the browser's own zone when the
 * offset is unknown. Read the result with the local getters (`getHours`, `getMinutes`).
 */
export function displayNow(utcOffsetMin: number | null | undefined, nowMs = Date.now()): Date {
  const d = new Date(nowMs)
  if (typeof utcOffsetMin !== 'number') return d
  const utcMs = nowMs + d.getTimezoneOffset() * MINUTE_MS
  return new Date(utcMs + utcOffsetMin * MINUTE_MS)
}

/** `{ time: '9:05', ampm: 'PM' }`: a 12-hour clock with no leading zero on the hour */
export function clockParts(d: Date): { time: string; ampm: 'AM' | 'PM' } {
  const h = d.getHours()
  const m = d.getMinutes()
  return {
    time: `${h % 12 === 0 ? 12 : h % 12}:${m < 10 ? `0${m}` : m}`,
    ampm: h < 12 ? 'AM' : 'PM',
  }
}

/** `'Sat, Nov 14'` */
export function dateLabel(d: Date): string {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** Milliseconds from `nowMs` until the next whole minute; UTC offsets are whole minutes. */
export function msToNextMinute(nowMs: number): number {
  return MINUTE_MS - (nowMs % MINUTE_MS)
}

export function sameMinute(a: Date, b: Date): boolean {
  return Math.floor(a.getTime() / MINUTE_MS) === Math.floor(b.getTime() / MINUTE_MS)
}
