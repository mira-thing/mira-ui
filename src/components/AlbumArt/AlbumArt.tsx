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
  const lastRef = useRef<string | undefined>(src)
  const cleanupRef = useRef(0)

  useEffect(() => {
    if (src === lastRef.current) return
    let cancelled = false
    void loadArtwork(src).then((img) => {
      if (cancelled) return
      lastRef.current = src
      const ready = img ? src : undefined
      if (showFront) {
        setBack(ready)
        setShowFront(false)
      } else {
        setFront(ready)
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
  }, [src, showFront])

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
      className={`${styles.art} ${pending ? styles.pending : ''}`}
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
