import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/ui/icons'
import styles from './IconButton.module.scss'

export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE_CLASS = { xs: styles.btnXs, sm: styles.btnSm, md: styles.btnMd, lg: styles.btnLg }
const ICON_SIZE = { xs: 32, sm: 43, md: 28, lg: 36 }

export interface IconButtonProps {
  /** a registry name renders at the size's default; pass a node to size it yourself */
  icon: IconName | ReactNode
  label: string
  size?: IconButtonSize
  onPress?: () => void
  // left undefined by controls that are never disabled or never a toggle, so they render
  // without the attribute at all
  disabled?: boolean
  pressed?: boolean
  // lit up, which repeat needs to keep separate from pressed: it reports pressed while
  // disabled for a DJ set, but must not look lit
  active?: boolean
  /** knob focus */
  focused?: boolean
}

export function IconButton({
  icon,
  label,
  size = 'md',
  onPress,
  disabled,
  pressed,
  active,
  focused,
}: IconButtonProps) {
  const className = [
    styles.btn,
    SIZE_CLASS[size],
    active && styles.toggleOn,
    disabled && styles.btnDisabled,
    focused && styles.focused,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onPress}
    >
      {typeof icon === 'string' ? <Icon name={icon as IconName} size={ICON_SIZE[size]} /> : icon}
    </button>
  )
}
