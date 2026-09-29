import { memo } from 'react'
import type { ConnectDevice } from '@/api/types'
import styles from './DevicePicker.module.scss'

interface Props {
  devices: ConnectDevice[]
  onSelect?: (device: ConnectDevice) => void
  placement?: 'inline' | 'modal'
  onClose?: () => void
}

const ICON_PATHS = {
  phone:
    'M5 5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zm3-1a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zM13.25 16.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z',
  pc: 'M0 21a1 1 0 0 1 1-1h22a1 1 0 1 1 0 2H1a1 1 0 0 1-1-1M3 5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm3-1a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z',
  generic:
    'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z',
} as const

function deviceIconKey(type: string): keyof typeof ICON_PATHS {
  switch (type.toUpperCase()) {
    case 'SMARTPHONE':
    case 'TABLET':
      return 'phone'
    case 'COMPUTER':
    case 'CHROMEBOOK':
      return 'pc'
    default:
      return 'generic'
  }
}

export function DeviceTypeIcon({ type, size = 22 }: { type: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden
      data-device-type={deviceIconKey(type)}
    >
      <path d={ICON_PATHS[deviceIconKey(type)]} />
    </svg>
  )
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
                <DeviceTypeIcon type={d.type} />
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
