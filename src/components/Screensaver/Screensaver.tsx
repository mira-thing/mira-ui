import { memo, useEffect, useState } from 'react'
import { Marquee } from '@/components/TrackInfo/Marquee'
import styles from './Screensaver.module.scss'

// double press of the power button opens this screensaver w clock
// also auto opens from the idle after 10 mins

interface Props {
  artUrl?: string | null
  utcOffsetMin?: number | null
  trackName?: string | null
  trackArtist?: string | null
  onClose: () => void
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function displayNow(utcOffsetMin: number | null | undefined): Date {
  const d = new Date()
  if (typeof utcOffsetMin !== 'number') return d
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000
  return new Date(utcMs + utcOffsetMin * 60_000)
}

const POWER_KEY_CODE = 'KeyM'
const ART_FADE_MS = 900

function ScreensaverImpl({ artUrl, utcOffsetMin, trackName, trackArtist, onClose }: Props) {
  const [now, setNow] = useState(() => displayNow(utcOffsetMin))

  useEffect(() => {
    setNow(displayNow(utcOffsetMin))
    const id = window.setInterval(() => {
      setNow((prev) => {
        const d = displayNow(utcOffsetMin)
        return d.getMinutes() !== prev.getMinutes() || d.getHours() !== prev.getHours() ? d : prev
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [utcOffsetMin])

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

  // swallow every key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === POWER_KEY_CODE) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === POWER_KEY_CODE) return
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

  let hours = now.getHours() % 12
  if (hours === 0) hours = 12
  const ampm = now.getHours() < 12 ? 'AM' : 'PM'
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
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
      <div className={styles.content}>
        <div className={styles.clock}>
          {hours}:{pad2(now.getMinutes())}
          <span className={styles.ampm}>{ampm}</span>
        </div>
        <div className={styles.date}>{date}</div>
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
    </div>
  )
}

export const Screensaver = memo(ScreensaverImpl)
