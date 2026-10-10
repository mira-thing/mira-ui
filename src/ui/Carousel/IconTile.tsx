import { Icon, type IconName } from '@/ui/icons'
import styles from './IconTile.module.scss'

export interface IconTileProps {
  icon: IconName
  size?: 'md' | 'lg'
}

const ICON_SIZE = { md: 26, lg: 34 } as const

/** A rounded-square tile holding one icon, as on the menu cards. */
export function IconTile({ icon, size = 'md' }: IconTileProps) {
  return (
    <span className={`${styles.tile} ${styles[size]}`}>
      <Icon name={icon} size={ICON_SIZE[size]} />
    </span>
  )
}
