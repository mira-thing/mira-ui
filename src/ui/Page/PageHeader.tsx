import type { ReactNode } from 'react'
import styles from './PageHeader.module.scss'

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
}

export function PageHeader({ title, subtitle, trailing }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle != null ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {trailing != null ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  )
}
