import { memo } from 'react'
import type { ConnectDevice } from '@/api/types'
import { Icon, deviceIconName } from '@/ui/icons'
import styles from './DevicePicker.module.scss'

interface Props {
  devices: ConnectDevice[]
  onSelect?: (device: ConnectDevice) => void
  placement?: 'inline' | 'modal'
  onClose?: () => void
}

function DeviceList({
  devices,
  onSelect,
}: {
  devices: ConnectDevice[]
  onSelect?: (d: ConnectDevice) => void
}) {
  return (
    <ul className={styles.list}>
      {devices.map((d) => {
        const interactive = Boolean(onSelect) && d.can_transfer && !d.is_offline
        return (
          <li key={d.id}>
            <div
              className={`${styles.row} ${d.is_active ? styles.active : ''} ${
                interactive ? styles.interactive : ''
              }`}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onSelect?.(d) : undefined}
            >
              <span className={styles.icon}>
                <Icon name={deviceIconName(d.type)} size={22} />
              </span>
              <span className={styles.name}>{d.name}</span>
              {d.is_active ? <span className={styles.activeDot} aria-label="active" /> : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DevicePickerImpl({ devices, onSelect, placement = 'inline', onClose }: Props) {
  const empty = <div className={styles.empty}>No active devices to select from for playback</div>

  if (placement === 'modal') {
    return (
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.cardModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>Devices</div>
          {devices.length === 0 ? empty : <DeviceList devices={devices} onSelect={onSelect} />}
        </div>
      </div>
    )
  }

  // always render the box even if no items
  return (
    <div className={styles.cardInline}>
      <div className={styles.header}>Devices</div>
      {devices.length === 0 ? empty : <DeviceList devices={devices} onSelect={onSelect} />}
    </div>
  )
}

export const DevicePicker = memo(DevicePickerImpl)
