import { memo } from 'react'
import { DevicePicker } from '@/components/DevicePicker'
import type { ConnectDevice } from '@/api/types'
import { Icon } from '@/ui/icons'
import styles from './IdleScreen.module.scss'

interface Props {
  connected: boolean
  devices: ConnectDevice[]
  onSelectDevice?: (device: ConnectDevice) => void
}

function IdleScreenImpl({ connected, devices, onSelectDevice }: Props) {
  const subtitle =
    devices.length > 0
      ? 'No remote device is currently playing. \n Select one below'
      : 'No remote device is currently playing. \n Open Spotify on your phone to control it here'

  return (
    <div className={styles.idle}>
      <div className={styles.icon} aria-hidden>
        <Icon name="playFilled" size={64} />
      </div>
      <div className={styles.title}>Nothing playing</div>
      <div className={styles.hint}>{subtitle}</div>
      <DevicePicker devices={devices} onSelect={onSelectDevice} placement="inline" />
      {!connected ? (
        <div className={styles.status}>
          <span className={`${styles.dot} ${styles.dotOff}`} aria-hidden />
          <span>Reconnecting...</span>
        </div>
      ) : null}
    </div>
  )
}

export const IdleScreen = memo(IdleScreenImpl)
