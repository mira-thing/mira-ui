import { memo } from 'react'
import { AlbumArt } from '@/components/AlbumArt'
import { Marquee } from '@/components/TrackInfo/Marquee'
import { presentTrack, useNarration } from '@/hooks/useDJNarration'
import { useArtLuminance } from '@/hooks/useColorExtract'
import type { ObserverStatusActive } from '@/api/types'
import styles from './NoLyricsView.module.scss'

interface Props {
  status: ObserverStatusActive
  active?: boolean
  // shrinks with the display size so the 130% glow stays inside the stage row
  artSize?: number
}

const ART_SIZE = 220
const GLOW_BASE = 0.75
const GLOW_CEILING = 0.34

function glowOpacity(luminance: number): number {
  return Math.min(GLOW_BASE, GLOW_CEILING / Math.max(luminance, 0.001))
}

function NoLyricsViewImpl({ status, active = true, artSize = ART_SIZE }: Props) {
  const narration = useNarration()
  const { title, artist, art, djFallback } = presentTrack(status, narration)
  const luminance = useArtLuminance(art)
  const glowStyle = art
    ? ({
        '--art': `url("${art}")`,
        '--glow-opacity': String(glowOpacity(luminance)),
      } as React.CSSProperties)
    : undefined

  return (
    <div className={styles.wrap}>
      <div className={styles.art}>
        {art ? (
          <div
            className={`${styles.glow} ${active ? '' : styles.paused}`}
            style={glowStyle}
            aria-hidden
          >
            <span className={`${styles.orb} ${styles.orbA}`} />
            <span className={`${styles.orb} ${styles.orbB}`} />
          </div>
        ) : null}
        <div className={styles.cover}>
          <AlbumArt src={art} size={artSize} djFallback={djFallback} />
        </div>
      </div>
      <div className={styles.meta}>
        <Marquee text={title || 'Unknown track'} className={styles.title} />
        <Marquee text={artist || 'Unknown artist'} className={styles.artist} />
      </div>
    </div>
  )
}

export const NoLyricsView = memo(NoLyricsViewImpl)
