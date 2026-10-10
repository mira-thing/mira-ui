import { memo, useEffect, useRef, useState } from 'react'
import { DJIcon } from '@/components/Controls/icons'
import styles from './AlbumArt.module.scss'
import { loadArtwork } from '@/hooks/useColorExtract'

interface Props {
  src: string | undefined
  size?: number
  alt?: string
  // show the DJ mark instead of an empty box
  djFallback?: boolean
  pending?: boolean
}

const FADE_MS = 220

function AlbumArtImpl({ src, size = 200, alt = '', djFallback = false, pending = false }: Props) {
  const [front, setFront] = useState<string | undefined>(src)
  const [back, setBack] = useState<string | undefined>(undefined)
  const [showFront, setShowFront] = useState(true)
  // the old cover stays up and dimmed
  const [shown, setShown] = useState(src)
  const cleanupRef = useRef(0)

  useEffect(() => {
    if (src === shown) return
    let cancelled = false
    // a failed preload still hands the url to the <img> for a second try
    void loadArtwork(src).then(() => {
      if (cancelled) return
      setShown(src)
      if (showFront) {
        setBack(src)
        setShowFront(false)
      } else {
        setFront(src)
        setShowFront(true)
      }
      window.clearTimeout(cleanupRef.current)
      cleanupRef.current = window.setTimeout(() => {
        if (showFront) setFront(undefined)
        else setBack(undefined)
      }, FADE_MS + 60)
    })
    return () => {
      cancelled = true
    }
  }, [src, shown, showFront])

  useEffect(() => () => window.clearTimeout(cleanupRef.current), [])

  const sizePx: React.CSSProperties = { width: size, height: size }

  // shared by both crossfade layers
  const empty = djFallback ? (
    <div className={styles.djFallback} role="img" aria-label="DJ">
      <DJIcon size={Math.round(size * 0.55)} />
    </div>
  ) : (
    <div className={styles.placeholder} />
  )

  return (
    <div
      className={`${styles.art} ${pending || src !== shown ? styles.pending : ''}`}
      style={sizePx}
      data-track-motion=""
      data-track-pending={pending}
    >
      <div
        className={`${styles.layer} ${showFront ? styles.show : styles.hide}`}
        aria-hidden={!showFront}
      >
        {front ? (
          <img
            key={front}
            src={front}
            alt={alt}
            decoding="async"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        ) : (
          empty
        )}
      </div>
      <div
        className={`${styles.layer} ${!showFront ? styles.show : styles.hide}`}
        aria-hidden={showFront}
      >
        {back ? (
          <img
            key={back}
            src={back}
            alt={alt}
            decoding="async"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        ) : (
          empty
        )}
      </div>
    </div>
  )
}

export const AlbumArt = memo(AlbumArtImpl)
