import { memo } from 'react'
import { AlbumArt } from '@/components/AlbumArt'

import { useArtworkSurface } from '@/components/AmbientGround'
import { Marquee } from '@/components/TrackInfo/Marquee'
import type { TrackPresentation } from '@/hooks/useDJNarration'
import styles from './NoLyricsView.module.scss'

interface Props extends TrackPresentation {
  artSize?: number
  pending?: boolean
}

const ART_SIZE = 220

function NoLyricsViewImpl({
  title,
  artist,
  art,
  djFallback,
  artSize = ART_SIZE,
  pending = false,
}: Props) {
  const surfaceStyle = useArtworkSurface(0, 0.22)

  return (
    <div className={styles.wrap} style={surfaceStyle} data-glass-panel="">
      <div className={styles.art}>
        <AlbumArt src={art} size={artSize} djFallback={djFallback} pending={pending} />
      </div>
      <div className={styles.meta} data-track-motion="">
        <Marquee text={title || 'Unknown track'} className={styles.title} />
        <Marquee text={artist || 'Unknown artist'} className={styles.artist} />
      </div>
    </div>
  )
}

export const NoLyricsView = memo(NoLyricsViewImpl)
