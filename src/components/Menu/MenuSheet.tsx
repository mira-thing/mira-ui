import type { CSSProperties, ReactNode } from 'react'
import type { KnobItemProps } from '@/input/useKnobNav'
import { Icon, type IconName } from '@/ui/icons'
import styles from './MenuSheet.module.scss'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  edge?: 'top' | 'bottom'
  style?: CSSProperties
  children: ReactNode
}

export function MenuSheet({ open, onClose, title, edge = 'bottom', style, children }: SheetProps) {
  return (
    <div
      className={`${styles.root} ${styles[edge]} ${open ? styles.open : ''}`}
      aria-hidden={!open}
      onClick={onClose}
    >
      <div
        className={styles.sheet}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function MenuGrid({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}

type Tone = 'danger' | 'support'

interface TileProps extends KnobItemProps {
  icon: IconName
  label: string
  detail: string
  on?: boolean
  tone?: Tone
}

export function MenuTile({ icon, label, detail, on, tone, focused, disabled, onClick }: TileProps) {
  const toggle = on !== undefined
  return (
    <button
      type="button"
      role={toggle ? 'switch' : undefined}
      aria-checked={toggle ? on : undefined}
      className={`${styles.tile} ${on ? styles.on : ''} ${tone ? styles[tone] : ''} ${focused ? styles.focused : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.tileIcon}>
        <Icon name={icon} />
      </span>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{detail}</span>
    </button>
  )
}

interface LinkProps extends KnobItemProps {
  icon: IconName
  label: string
  detail?: string
  tone?: Tone
}

export function MenuLink({ icon, label, detail, tone, focused, disabled, onClick }: LinkProps) {
  return (
    <button
      type="button"
      className={`${styles.link} ${tone ? styles[tone] : ''} ${focused ? styles.focused : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.linkIcon}>
        <Icon name={icon} />
      </span>
      <span className={styles.linkText}>
        <span className={styles.linkLabel}>{label}</span>
        {detail ? <span className={styles.linkDetail}>{detail}</span> : null}
      </span>
      <span className={styles.chevron}>
        <Icon name="chevronRight" size={20} />
      </span>
    </button>
  )
}
