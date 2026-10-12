import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { loadArtwork } from '@/hooks/useColorExtract'
import { Icon } from '@/ui/icons'
import styles from './Artwork.module.scss'

export type ArtworkFallback = 'none' | 'dj' | 'liked' | 'playlist'

export interface ArtworkProps {
  src: string | undefined
  size?: number
  alt?: string
  radius?: 'art' | 'sm'
  /** shown instead of an empty box when there is no src */
  fallback?: ArtworkFallback
  /** false mounts a single layer with no swap timers, for list rows */
  crossfade?: boolean
  /** dims the cover while the next track is on its way; crossfade only */
  pending?: boolean
}

const FADE_MS = 220

function fallbackNode(fallback: ArtworkFallback, size: number): ReactNode {
  switch (fallback) {
    case 'dj':
      return (
        <div className={styles.djFallback} role="img" aria-label="DJ">
          <Icon name="dj" size={Math.round(size * 0.55)} />
        </div>
      )
    case 'liked':
      return (
        <div className={styles.likedFallback} role="img" aria-label="Liked Songs">
          <Icon name="heart" size={Math.round(size * 0.45)} />
        </div>
      )
    case 'playlist':
      return (
        <div className={styles.iconFallback} role="img" aria-label="Playlist">
          <Icon name="playlist" size={Math.round(size * 0.45)} />
        </div>
      )
    default:
      return <div className={styles.placeholder} />
  }
}

function ArtImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}

interface FrameProps {
  src: string | undefined
  alt: string
  size: number
  className: string
  empty: ReactNode
}

function SingleLayer({ src, alt, size, className, empty }: FrameProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <div className={styles.layer}>{src ? <ArtImage key={src} src={src} alt={alt} /> : empty}</div>
    </div>
  )
}

function Crossfade({
  src,
  alt,
  size,
  className,
  empty,
  pending,
}: FrameProps & { pending: boolean }) {
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

  return (
    <div
      className={`${className} ${pending || src !== shown ? styles.pending : ''}`}
      style={sizePx}
      data-track-motion=""
      data-track-pending={pending}
    >
      <div
        className={`${styles.layer} ${showFront ? styles.show : styles.hide}`}
        aria-hidden={!showFront}
      >
        {front ? <ArtImage key={front} src={front} alt={alt} /> : empty}
      </div>
      <div
        className={`${styles.layer} ${!showFront ? styles.show : styles.hide}`}
        aria-hidden={showFront}
      >
        {back ? <ArtImage key={back} src={back} alt={alt} /> : empty}
      </div>
    </div>
  )
}

function ArtworkImpl({
  src,
  size = 200,
  alt = '',
  radius = 'art',
  fallback = 'none',
  crossfade = true,
  pending = false,
}: ArtworkProps) {
  const className = radius === 'sm' ? `${styles.art} ${styles.radiusSm}` : styles.art
  const frame = { src, alt, size, className, empty: fallbackNode(fallback, size) }
  return crossfade ? <Crossfade {...frame} pending={pending} /> : <SingleLayer {...frame} />
}

export const Artwork = memo(ArtworkImpl)
