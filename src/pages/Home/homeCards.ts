import type { TrackPresentation } from '@/hooks/useDJNarration'
import type { IconName } from '@/ui/icons'

export type HomeCardKey =
  'now-playing' | 'resume' | 'playlists' | 'queue' | 'devices' | 'bluetooth' | 'settings'

export interface HomeCard {
  key: HomeCardKey
  icon: IconName
  title: string
  subtitle: string
  /** the now-playing card shows the cover in place of its icon */
  track?: TrackPresentation
}

export interface HomeCardsInput {
  /** what the player is presenting, or null when nothing plays */
  nowPlaying: TrackPresentation | null
  /** the device playing, when one is */
  deviceName: string | null
  /** Spotify Connect devices in reach */
  deviceCount: number
  /** the phone connected over Bluetooth, if any */
  btDeviceName: string | null
}

/** Home's cards in knob order. The first is always playback: back to the player, or resume. */
export function homeCards({
  nowPlaying,
  deviceName,
  deviceCount,
  btDeviceName,
}: HomeCardsInput): HomeCard[] {
  const playback: HomeCard = nowPlaying
    ? {
        key: 'now-playing',
        icon: 'playFilled',
        title: nowPlaying.title,
        subtitle: nowPlaying.artist,
        track: nowPlaying,
      }
    : { key: 'resume', icon: 'play', title: 'Resume', subtitle: 'Last played device' }
  const devices =
    deviceName ?? (deviceCount > 0 ? `${deviceCount} available` : 'Open Spotify on your phone')
  return [
    playback,
    { key: 'playlists', icon: 'playlist', title: 'Playlists', subtitle: 'Your library' },
    {
      key: 'queue',
      icon: 'queue',
      title: 'Queue',
      subtitle: nowPlaying ? 'Up next' : 'Nothing queued',
    },
    { key: 'devices', icon: 'computer', title: 'Devices', subtitle: devices },
    {
      key: 'bluetooth',
      icon: 'bluetoothLarge',
      title: 'Bluetooth',
      subtitle: btDeviceName ?? 'Pair a phone',
    },
    {
      key: 'settings',
      icon: 'sliders',
      title: 'Settings',
      subtitle: 'Display, lyrics, brightness',
    },
  ]
}

export const homeCardKey = (card: HomeCard) => card.key
