import { memo, useEffect, useState } from 'react'
import type { Carriers } from '@/hooks/useBluetooth'
import styles from './ReconnectBanner.module.scss'
import { useOverlayActivity } from '@/notify/notifyContext'

export type ReconnectReason = 'offline' | 'ws' | 'dealer'

interface Props {
  reason: ReconnectReason
  carriers: Carriers | null
}

// after this long the generic "Reconnecting..." escalates to a reason aware message
const PROLONGED_MS = 25000

// persistent top banner shown while the player holds the last now-playing
function ReconnectBannerImpl({ reason, carriers }: Props) {
  const [prolonged, setProlonged] = useState(false)
  const { volumeVisible, notificationVisible } = useOverlayActivity()

  useEffect(() => {
    const t = window.setTimeout(() => setProlonged(true), PROLONGED_MS)
    return () => window.clearTimeout(t)
  }, [])

  let message = 'Reconnecting...'
  if (prolonged) {
    if (reason === 'offline') {
      if (carriers?.bt) {
        message = 'Phone connected, but no internet. Check Bluetooth tethering on your phone'
      } else if (carriers?.usb) {
        message = 'USB connected, but no internet'
      } else {
        message = 'Connection to your phone lost. Bring it in range or check Bluetooth'
      }
    } else {
      message = 'Still reconnecting to Spotify...'
    }
  }

  if (notificationVisible) return null
  return (
    <div
      className={`${styles.banner} ${volumeVisible ? styles.lowered : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.pulseDot} aria-hidden />
      <span className={styles.message}>{message}</span>
    </div>
  )
}

export const ReconnectBanner = memo(ReconnectBannerImpl)
