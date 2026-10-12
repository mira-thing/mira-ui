import type { MouseEvent, ReactNode } from 'react'
import { Surface } from '@/ui/Surface'
import styles from './Dialog.module.scss'

export interface DialogProps {
  open: boolean
  /** a tap on the scrim; Back is the caller's, through `useRouteBack` */
  onClose?: () => void
  title?: string
  width?: 'sm' | 'md' | 'lg'
  /** `solid` is the flat card today's dialogs use; `glass` is the floating surface */
  surface: 'glass' | 'solid'
  children?: ReactNode
}

const stop = (e: MouseEvent) => e.stopPropagation()

/** A modal card over a scrim that fills the nearest positioned ancestor. */
export function Dialog({ open, onClose, title, width = 'md', surface, children }: DialogProps) {
  if (!open) return null
  const body = (
    <>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      {children}
    </>
  )
  const common = {
    role: 'dialog',
    'aria-modal': true,
    'aria-label': title,
    onClick: stop,
  } as const
  return (
    <div className={styles.scrim} onClick={onClose} role="presentation">
      {surface === 'glass' ? (
        <Surface
          {...common}
          variant="floating"
          cache={false}
          className={`${styles.card} ${styles.glass} ${styles[width]}`}
        >
          {body}
        </Surface>
      ) : (
        <div {...common} className={`${styles.card} ${styles.solid} ${styles[width]}`}>
          {body}
        </div>
      )}
    </div>
  )
}
