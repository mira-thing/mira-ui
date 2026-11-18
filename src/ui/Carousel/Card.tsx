import type { ReactNode } from 'react'
import { Surface } from '@/ui/Surface'
import type { IconName } from '@/ui/icons'
import { IconTile } from './IconTile'
import styles from './Card.module.scss'

export interface CardProps {
  icon?: IconName
  /** drawn in place of the icon tile, e.g. a cover */
  media?: ReactNode
  title: string
  subtitle?: string
  focused: boolean
  /** leave out inside a `Carousel`, which focuses then selects on tap */
  onSelect?: () => void
}

/** A tall glass card: an icon tile at the top, the title and subtitle at the bottom. */
export function Card({ icon, media, title, subtitle, focused, onSelect }: CardProps) {
  return (
    <Surface variant="card" focused={focused} className={styles.card} onClick={onSelect}>
      {media ?? (icon ? <IconTile icon={icon} /> : null)}
      <div className={styles.text}>
        <div className={styles.title}>{title}</div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>
    </Surface>
  )
}
