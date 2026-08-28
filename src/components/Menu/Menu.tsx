import { memo } from 'react'
import styles from './Menu.module.scss'

export type RepeatMode = 'off' | 'context' | 'track'

interface Props {
  open: boolean
  onClose: () => void

  showLyrics: boolean
  onToggleLyrics: () => void

  karaokeLyrics: boolean
  onToggleKaraoke: () => void

  voiceMic: boolean
  onToggleVoiceMic: () => void

  currentDevice?: string
  onOpenDevices: () => void

  onOpenBluetooth: () => void
  onOpenSettings: () => void
}

function MenuImpl({
  open,
  onClose,
  showLyrics,
  onToggleLyrics,
  karaokeLyrics,
  onToggleKaraoke,
  voiceMic,
  onToggleVoiceMic,
  currentDevice,
  onOpenDevices,
  onOpenBluetooth,
  onOpenSettings,
}: Props) {
  return (
    <div
      className={`${styles.root} ${open ? styles.open : styles.closed}`}
      aria-hidden={!open}
      onClick={onClose}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden />
        <Row label="Show Lyrics" value={showLyrics ? 'On' : 'Off'} onClick={onToggleLyrics} />
        <Row
          label="Karaoke Lyrics"
          value={karaokeLyrics ? 'On' : 'Off'}
          onClick={onToggleKaraoke}
        />
        <Row label="Mic" value={voiceMic ? 'On' : 'Off'} onClick={onToggleVoiceMic} />
        <Row label="Devices" value={currentDevice ?? 'Switch'} onClick={onOpenDevices} />
        <Row label="Bluetooth Pairing" value="" onClick={onOpenBluetooth} />
        <Row label="Settings" value="" onClick={onOpenSettings} />
      </div>
    </div>
  )
}

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.row} onClick={onClick}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </button>
  )
}

export const Menu = memo(MenuImpl)
