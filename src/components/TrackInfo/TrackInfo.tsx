import { memo } from 'react'
import { Marquee } from './Marquee'
import styles from './TrackInfo.module.scss'

interface Props {
  trackName: string
  artist: string
  large?: boolean
  compact?: boolean
}

function TrackInfoImpl({ trackName, artist, large = false, compact = false }: Props) {
  return (
    <div className={`${styles.info} ${large ? styles.large : ''} ${compact ? styles.compact : ''}`}>
      <Marquee text={trackName || 'Unknown track'} className={styles.title} />
      <Marquee text={artist || 'Failed to fetch'} className={styles.artist} />
    </div>
  )
}

export const TrackInfo = memo(TrackInfoImpl)
