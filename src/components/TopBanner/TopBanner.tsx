import styles from './TopBanner.module.scss'
import { DeviceTypeIcon } from '@/components/DevicePicker/DevicePicker'
import { DJIcon } from '@/components/Controls/icons'

export type BannerVariant = 'info' | 'success' | 'warning' | 'error'
export type BannerIcon =
  BannerVariant | 'microphone' | 'thinking' | 'play' | 'playlist' | 'device' | 'bluetooth' | 'dj'

const icons = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.1" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 4a2 2 0 0 1 3.4 0l7 12a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3Z" />
      <path d="M12 8v4m0 3v.1" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6m0-6-6 6" />
    </>
  ),
  microphone: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3m-3 0h6" />
    </>
  ),
  thinking: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  play: <path d="m8 4 12 8-12 8Z" />,
  playlist: (
    <>
      <path d="M4 5h16M4 10h10M4 15h6m5-1 6 4-6 4Z" />
    </>
  ),
  bluetooth: <path d="m7 7 10 10-5 4V3l5 4L7 17" />,
}

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
  return (
    <div
      className={`${styles.banner} ${visible ? styles.visible : ''} ${lowered ? styles.lowered : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span className={`${styles.icon} ${styles[variant] ?? ''}`}>
        {icon === 'device' ? (
          <DeviceTypeIcon type={deviceType ?? ''} />
        ) : icon === 'dj' ? (
          <DJIcon size={20} />
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            data-notification-icon={icon}
          >
            {icons[icon]}
          </svg>
        )}
      </span>
      <span className={styles.message}>{message}</span>
    </div>
  )
}
