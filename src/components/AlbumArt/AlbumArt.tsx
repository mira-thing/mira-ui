import { memo, useEffect, useRef, useState } from 'react'
import { DJIcon } from '@/components/Controls/icons'
import styles from './AlbumArt.module.scss'

interface Props {
  src: string | undefined
  size?: number
  alt?: string
  // show the DJ mark instead of an empty box
  djFallback?: boolean
}

const FADE_MS = 220

function AlbumArtImpl({ src, size = 200, alt = '', djFallback = false }: Props) {
  const [front, setFront] = useState<string | undefined>(src)
  const [back, setBack] = useState<string | undefined>(undefined)
  const [showFront, setShowFront] = useState(true)
  const lastRef = useRef<string | undefined>(src)
  const cleanupRef = useRef(0)

  useEffect(() => {
    if (src === lastRef.current) return
    lastRef.current = src

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
    <div className={styles.art} style={sizePx}>
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
          />
        ) : (
          empty
        )}
      </div>
    </div>
  )
}

export const AlbumArt = memo(AlbumArtImpl)
