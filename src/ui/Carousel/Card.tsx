import { Surface } from '@/ui/Surface'
import type { IconName } from '@/ui/icons'
import { IconTile } from './IconTile'
import styles from './Card.module.scss'

export interface CardProps {
  icon: IconName
  title: string
  subtitle?: string
  focused: boolean
  /** leave out inside a `Carousel`, which focuses then selects on tap */
  onSelect?: () => void
}

/** A tall glass card: an icon tile at the top, the title and subtitle at the bottom. */
export function Card({ icon, title, subtitle, focused, onSelect }: CardProps) {
  return (
    <Surface
      variant="card"
      focused={focused}
      cache={false}
      className={styles.card}
      onClick={onSelect}
    >
      <IconTile icon={icon} />
      <div className={styles.text}>
        <div className={styles.title}>{title}</div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>
    </Surface>
  )
}
