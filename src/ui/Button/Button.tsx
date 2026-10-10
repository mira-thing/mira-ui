import type { ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from '@/ui/icons'
import styles from './Button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'lg'
  icon?: IconName
  /** knob focus */
  focused?: boolean
  /** fills the width of its container */
  block?: boolean
}

const ICON_SIZE = { md: 20, lg: 24 } as const

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  focused = false,
  block = false,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    block ? styles.block : '',
    focused ? styles.focused : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button {...props} type={type} className={classes}>
      {icon ? <Icon name={icon} size={ICON_SIZE[size]} /> : null}
      {children != null ? <span>{children}</span> : null}
    </button>
  )
}
