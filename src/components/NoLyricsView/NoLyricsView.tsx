import { memo } from 'react'
import { AlbumArt } from '@/components/AlbumArt'
import { Marquee } from '@/components/TrackInfo/Marquee'
import type { TrackPresentation } from '@/hooks/useDJNarration'
import { Surface } from '@/ui/Surface'
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
  return (
    <Surface variant="panel" tint={0.22} className={styles.wrap}>
      <div className={styles.art}>
        <AlbumArt src={art} size={artSize} djFallback={djFallback} pending={pending} />
      </div>
      <div className={styles.meta} data-track-motion="">
        <Marquee text={title || 'Unknown track'} className={styles.title} />
        <Marquee text={artist || 'Unknown artist'} className={styles.artist} />
      </div>
    </Surface>
  )
}

export const NoLyricsView = memo(NoLyricsViewImpl)
