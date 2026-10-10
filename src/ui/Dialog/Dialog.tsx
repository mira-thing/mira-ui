import type { MouseEvent, ReactNode } from 'react'
import { usePageActive } from '@/app/pageActive'
import { useRouteBack } from '@/app/routeBack'
import { Layer } from '@/input/router'
import { useKnobScope } from '@/input/useKnobScope'
import { Surface } from '@/ui/Surface'
import styles from './Dialog.module.scss'

export interface DialogProps {
  open: boolean
  /** a tap on the scrim or a Back press */
  onClose?: () => void
  title?: string
  width?: 'sm' | 'md' | 'lg'
  /** `solid` is the flat card today's dialogs use; `glass` is the floating surface */
  surface: 'glass' | 'solid'
  children?: ReactNode
}

const stop = (e: MouseEvent) => e.stopPropagation()

/**
 * A modal card over a scrim that fills the nearest positioned ancestor. While open it holds the
 * knob, so nothing behind it moves, and takes Back to call `onClose`.
 */
export function Dialog({ open, onClose, title, width = 'md', surface, children }: DialogProps) {
  const active = usePageActive()
  useKnobScope({
    layer: Layer.modal,
    enabled: open && active,
    onStep: () => true,
    onSelect: () => true,
  })
  useRouteBack(() => {
    if (!open || !onClose) return false
    onClose()
    return true
  })

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
