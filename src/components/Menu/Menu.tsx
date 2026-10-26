import { memo, useState } from 'react'
import { Layer } from '@/input/router'
import { useKnobNav, type KnobItemProps } from '@/input/useKnobNav'
import { accentVar, useTheme } from '@/theme/theme'
import { Icon, type IconName } from '@/ui/icons'
import styles from './Menu.module.scss'

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

  onOpenSettings: () => void
}

type Item = 'lyrics' | 'karaoke' | 'mic' | 'devices' | 'settings'
const ITEMS: readonly Item[] = ['lyrics', 'karaoke', 'mic', 'devices', 'settings']

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
  onOpenSettings,
}: Props) {
  const theme = useTheme()
  const actions: Record<Item, () => void> = {
    lyrics: onToggleLyrics,
    karaoke: onToggleKaraoke,
    mic: onToggleVoiceMic,
    devices: onOpenDevices,
    settings: onOpenSettings,
  }
  const nav = useKnobNav({
    keys: ITEMS,
    onSelect: (item) => actions[item](),
    enabled: open,
    layer: Layer.modal,
  })

  // every open starts at the top
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) nav.setFocus(ITEMS[0])
  }

  return (
    <div
      className={`${styles.root} ${open ? styles.open : ''}`}
      aria-hidden={!open}
      onClick={onClose}
    >
      <div
        className={styles.sheet}
        style={accentVar(theme)}
        role="dialog"
        aria-modal="true"
        aria-label="Quick access"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.title}>Quick access</h2>
        <div className={styles.toggles}>
          <Toggle
            icon="textLines"
            label="Show lyrics"
            on={showLyrics}
            {...nav.itemProps('lyrics')}
          />
          <Toggle icon="lyrics" label="Karaoke" on={karaokeLyrics} {...nav.itemProps('karaoke')} />
          <Toggle
            icon={voiceMic ? 'microphone' : 'microphoneOff'}
            label="Mic"
            on={voiceMic}
            {...nav.itemProps('mic')}
          />
        </div>
        <div className={styles.links}>
          <Link
            icon="speakerBox"
            label="Devices"
            detail={currentDevice ?? 'Switch'}
            {...nav.itemProps('devices')}
          />
          <Link
            icon="gear"
            label="Settings"
            detail="Brightness, pairing & more"
            {...nav.itemProps('settings')}
          />
        </div>
      </div>
    </div>
  )
}

interface ToggleProps extends KnobItemProps {
  icon: IconName
  label: string
  on: boolean
}

function Toggle({ icon, label, on, focused, onClick }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`${styles.tile} ${on ? styles.on : ''} ${focused ? styles.focused : ''}`}
      onClick={onClick}
    >
      <span className={styles.tileIcon}>
        <Icon name={icon} />
      </span>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{on ? 'On' : 'Off'}</span>
    </button>
  )
}

interface LinkProps extends KnobItemProps {
  icon: IconName
  label: string
  detail?: string
}

function Link({ icon, label, detail, focused, onClick }: LinkProps) {
  return (
    <button
      type="button"
      className={`${styles.link} ${focused ? styles.focused : ''}`}
      onClick={onClick}
    >
      <span className={styles.linkIcon}>
        <Icon name={icon} />
      </span>
      <span className={styles.linkText}>
        <span className={styles.linkLabel}>{label}</span>
        {detail ? <span className={styles.linkDetail}>{detail}</span> : null}
      </span>
      <span className={styles.chevron}>
        <Icon name="chevronRight" size={20} />
      </span>
    </button>
  )
}

export const Menu = memo(MenuImpl)
