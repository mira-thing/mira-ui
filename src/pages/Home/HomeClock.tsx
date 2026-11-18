import { memo } from 'react'
import { useMinuteClock } from '@/hooks/useMinuteClock'
import { clockParts } from '@/utils/clock'
import styles from './HomePage.module.scss'

/** The header clock, in the screensaver's format; only this leaf re-renders on the minute. */
export const HomeClock = memo(function HomeClock({
  utcOffsetMin,
}: {
  utcOffsetMin: number | null
}) {
  const { time, ampm } = clockParts(useMinuteClock(utcOffsetMin))
  return (
    <div className={styles.clock} data-testid="home-clock">
      {time}
      <span className={styles.ampm}>{ampm}</span>
    </div>
  )
})
