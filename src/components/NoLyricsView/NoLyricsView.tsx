import { memo } from 'react'
import type { TrackPresentation } from '@/hooks/useDJNarration'
import { Artwork } from '@/ui/Artwork'
import { Surface } from '@/ui/Surface'
import { TrackText } from '@/ui/TrackText'
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
        <Artwork src={art} size={artSize} fallback={djFallback ? 'dj' : 'none'} pending={pending} />
      </div>
      <TrackText title={title} artist={artist} size="hero" className={styles.meta} />
    </Surface>
  )
}

export const NoLyricsView = memo(NoLyricsViewImpl)
