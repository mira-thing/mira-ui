import { memo } from 'react'
import { Marquee } from './Marquee'
import styles from './TrackText.module.scss'

export interface TrackTextProps {
  title: string
  artist: string
  /** `mini` for the mini-player, `panel` under the player's artwork, `hero` beside large artwork */
  size: 'mini' | 'panel' | 'hero'
  /** false ellipsizes overflowing text instead of scrolling it */
  scroll?: boolean
  className?: string
}

function Line({ text, className, scroll }: { text: string; className: string; scroll: boolean }) {
  if (scroll) return <Marquee text={text} className={className} />
  return (
    <div className={`${styles.line} ${className}`} dir="auto">
      {text}
    </div>
  )
}

function TrackTextImpl({ title, artist, size, scroll = true, className }: TrackTextProps) {
  return (
    <div
      className={[styles.text, styles[size], className].filter(Boolean).join(' ')}
      data-track-motion=""
    >
      <Line text={title || 'Unknown track'} className={styles.title} scroll={scroll} />
      <Line text={artist || 'Unknown artist'} className={styles.artist} scroll={scroll} />
    </div>
  )
}

export const TrackText = memo(TrackTextImpl)
