import styles from './TopBanner.module.scss'
import { Icon, deviceIconName, type IconName } from '@/ui/icons'

export type BannerVariant = 'info' | 'success' | 'warning' | 'error'
// 'device' resolves to the glyph for the notification's deviceType
export type BannerIcon = IconName | 'device'

interface Props {
  visible: boolean
  message: string
  variant?: BannerVariant
  icon?: BannerIcon
  lowered?: boolean
  deviceType?: string
}

// inteded to be reusable for future stuff like reconnecting and etc
export function TopBanner({
  visible,
  message,
  variant = 'info',
  icon = variant,
  lowered = false,
  deviceType,
}: Props) {
  const name = icon === 'device' ? deviceIconName(deviceType ?? '') : icon
  return (
    <div
      className={`${styles.banner} ${visible ? styles.visible : ''} ${lowered ? styles.lowered : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span className={`${styles.icon} ${styles[variant] ?? ''}`}>
        {icon === 'device' ? (
          <Icon name={name} size={22} data-device-type={name} />
        ) : (
          <Icon name={name} size={icon === 'dj' ? 20 : 22} data-notification-icon={icon} />
        )}
      </span>
      <span className={styles.message}>{message}</span>
    </div>
  )
}
