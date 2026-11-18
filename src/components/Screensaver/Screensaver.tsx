import { memo, useEffect, useState } from 'react'
import { useMinuteClock } from '@/hooks/useMinuteClock'
import { Layer } from '@/input/router'
import { useKnobScope } from '@/input/useKnobScope'
import { Marquee } from '@/ui/TrackText'
import { clockParts, dateLabel } from '@/utils/clock'
import styles from './Screensaver.module.scss'

// double press of the power button opens this screensaver w clock
// also auto opens from the idle after 10 mins

interface Props {
  artUrl?: string | null
  utcOffsetMin?: number | null
  trackName?: string | null
  trackArtist?: string | null
  onClose: () => void
  /** the knob press plays and pauses, ahead of any card left under the screensaver */
  onPlayPause: () => void
}

const POWER_KEY_CODE = 'KeyM'
const ART_FADE_MS = 900

function ScreensaverImpl({
  artUrl,
  utcOffsetMin,
  trackName,
  trackArtist,
  onClose,
  onPlayPause,
}: Props) {
  const now = useMinuteClock(utcOffsetMin)

  const [shownArt, setShownArt] = useState<string | null>(artUrl ?? null)
  const [prevArt, setPrevArt] = useState<string | null>(null)
  useEffect(() => {
    const next = artUrl ?? null
    if (next === shownArt) return
    if (!next) {
      setShownArt(null)
      setPrevArt(null)
      return
    }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      setPrevArt(shownArt)
      setShownArt(next)
    }
    img.onerror = () => {
      if (cancelled) return
      setShownArt(next)
    }
    img.src = next
    return () => {
      cancelled = true
    }
  }, [artUrl, shownArt])
  useEffect(() => {
    if (prevArt == null) return
    const t = window.setTimeout(() => setPrevArt(null), ART_FADE_MS)
    return () => window.clearTimeout(t)
  }, [prevArt])

  useKnobScope({ layer: Layer.system, enabled: true, onSelect: () => onPlayPause() })

  // swallow every key except knob controls
  useEffect(() => {
    const passes = (e: KeyboardEvent) => e.code === POWER_KEY_CODE || e.key === 'Enter'
    const onKeyDown = (e: KeyboardEvent) => {
      if (passes(e)) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (passes(e)) return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('keyup', onKeyUp, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('keyup', onKeyUp, { capture: true })
    }
  }, [onClose])

  const { time, ampm } = clockParts(now)
  const date = dateLabel(now)
  const playing = Boolean(trackName)
  const thumbUrl = artUrl || shownArt

  return (
    <div className={styles.container} onClick={onClose}>
      {prevArt ? (
        <div className={styles.art} style={{ backgroundImage: `url(${prevArt})` }} aria-hidden />
      ) : null}
      {shownArt ? (
        <div
          key={shownArt}
          className={`${styles.art} ${styles.artEnter}`}
          style={{ backgroundImage: `url(${shownArt})` }}
          aria-hidden
        />
      ) : (
        <div className={styles.plain} aria-hidden />
      )}
      <div className={styles.scrim} aria-hidden />
      <div className={`${styles.content} ${playing ? styles.withPill : ''}`}>
        <div className={styles.date}>{date}</div>
        <div className={styles.clock}>
          {time}
          <span className={styles.ampm}>{ampm}</span>
        </div>
      </div>
      {playing && trackName ? (
        <div className={styles.nowPlayingDock}>
          <div className={`${styles.nowPlaying} ${!thumbUrl ? styles.noThumb : ''}`}>
            {thumbUrl ? (
              <div
                className={styles.thumb}
                style={{ backgroundImage: `url(${thumbUrl})` }}
                aria-hidden
              />
            ) : null}
            <div className={styles.nowPlayingMeta}>
              <Marquee text={trackName} className={styles.nowPlayingTrack} />
              {trackArtist ? (
                <Marquee text={trackArtist} className={styles.nowPlayingArtist} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const Screensaver = memo(ScreensaverImpl)
