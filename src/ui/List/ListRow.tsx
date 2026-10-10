import type { HTMLAttributes, ReactNode } from 'react'
import styles from './ListRow.module.scss'

export interface ListRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** outside the hit area, so it may hold its own control */
  trailing?: ReactNode
  /** a short read-out at the end of the hit area, such as a setting's current value */
  value?: ReactNode
  tone?: 'default' | 'danger'
  /** knob focus, from `useKnobNav` */
  focused?: boolean
  /** the item in effect, such as the playing track */
  active?: boolean
  disabled?: boolean
  variant?: 'plain' | 'pill'
  onSelect?: () => void
  as?: 'div' | 'li'
}

/** A list row: never glass. Spread `nav.itemProps(key)` onto it outside a `KnobList`. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  value,
  tone = 'default',
  focused = false,
  active = false,
  disabled = false,
  variant = 'plain',
  onSelect,
  as: Tag = 'div',
  className,
  ...props
}: ListRowProps) {
  const classes = [
    styles.row,
    styles[variant],
    tone === 'danger' ? styles.danger : '',
    focused ? styles.focused : '',
    active ? styles.active : '',
    disabled ? styles.disabled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <Tag {...props} className={classes} aria-disabled={disabled || undefined}>
      <button
        type="button"
        tabIndex={-1}
        className={styles.hit}
        disabled={disabled}
        onClick={onSelect}
      >
        {leading != null ? <span className={styles.leading}>{leading}</span> : null}
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          {subtitle != null ? <span className={styles.subtitle}>{subtitle}</span> : null}
        </span>
        {value != null ? <span className={styles.value}>{value}</span> : null}
      </button>
      {trailing != null ? <span className={styles.trailing}>{trailing}</span> : null}
    </Tag>
  )
}
