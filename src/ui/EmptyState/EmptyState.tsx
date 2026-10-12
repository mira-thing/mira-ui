import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/ui/icons'
import styles from './EmptyState.module.scss'

export interface EmptyStateProps {
  icon?: IconName
  title: ReactNode
  body?: ReactNode
  /** `page` fills its container; `inline` sits inside a list or panel */
  size?: 'inline' | 'page'
  className?: string
}

const ICON_SIZE = { inline: 24, page: 48 } as const

export function EmptyState({ icon, title, body, size = 'inline', className }: EmptyStateProps) {
  return (
    <div className={[styles.empty, styles[size], className].filter(Boolean).join(' ')}>
      {icon ? <Icon name={icon} size={ICON_SIZE[size]} className={styles.icon} /> : null}
      <p className={styles.title}>{title}</p>
      {body != null ? <p className={styles.body}>{body}</p> : null}
    </div>
  )
}
