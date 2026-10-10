import type { HTMLAttributes, ReactNode } from 'react'
import styles from './SectionHeader.module.scss'

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  trailing?: ReactNode
}

export function SectionHeader({ children, trailing, className, ...props }: SectionHeaderProps) {
  return (
    <div {...props} className={[styles.header, className].filter(Boolean).join(' ')}>
      <span className={styles.title}>{children}</span>
      {trailing != null ? <span className={styles.trailing}>{trailing}</span> : null}
    </div>
  )
}
