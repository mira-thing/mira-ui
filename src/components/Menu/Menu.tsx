import { memo, useState } from 'react'
import { Layer } from '@/input/router'
import { useKnobNav } from '@/input/useKnobNav'
import { accentVar, useTheme } from '@/theme/theme'
import { MenuGrid, MenuLink, MenuSheet, MenuTile } from './MenuSheet'

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
    <MenuSheet open={open} onClose={onClose} title="Quick access" style={accentVar(theme)}>
      <MenuGrid columns={3}>
        <MenuTile
          icon="textLines"
          label="Show lyrics"
          detail={showLyrics ? 'On' : 'Off'}
          on={showLyrics}
          {...nav.itemProps('lyrics')}
        />
        <MenuTile
          icon="lyrics"
          label="Karaoke"
          detail={karaokeLyrics ? 'On' : 'Off'}
          on={karaokeLyrics}
          {...nav.itemProps('karaoke')}
        />
        <MenuTile
          icon={voiceMic ? 'microphone' : 'microphoneOff'}
          label="Mic"
          detail={voiceMic ? 'On' : 'Off'}
          on={voiceMic}
          {...nav.itemProps('mic')}
        />
      </MenuGrid>
      <MenuGrid columns={2}>
        <MenuLink
          icon="speakerBox"
          label="Devices"
          detail={currentDevice ?? 'Switch'}
          {...nav.itemProps('devices')}
        />
        <MenuLink
          icon="gear"
          label="Settings"
          detail="Brightness, pairing & more"
          {...nav.itemProps('settings')}
        />
      </MenuGrid>
    </MenuSheet>
  )
}

export const Menu = memo(MenuImpl)
