import type { ReactNode } from 'react'
import styles from './Page.module.scss'

export interface PageProps {
  header?: ReactNode
  footer?: ReactNode
  /** scrolls natively; a `KnobList` at full height fills it instead */
  children: ReactNode
  className?: string
}

/** A full-height page: fixed header and footer around a content area that takes the rest. */
export function Page({ header, footer, children, className }: PageProps) {
  return (
    <div className={[styles.page, className].filter(Boolean).join(' ')}>
      {header != null ? <div className={styles.header}>{header}</div> : null}
      <div className={styles.content}>{children}</div>
      {footer != null ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  )
}
