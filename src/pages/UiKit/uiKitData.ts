import { makeMockStatus } from '@/dev/mockStatus'
import type { ArtworkFallback } from '@/ui/Artwork'
import type { IconName } from '@/ui/icons'
import type { ListSection } from '@/ui/List'

export interface KitCard {
  key: string
  icon: IconName
  title: string
  subtitle: string
}

// the menu as the mockup has it
export const CARDS: readonly KitCard[] = [
  { key: 'playlists', icon: 'playlist', title: 'Playlists', subtitle: 'Coming soon' },
  { key: 'queue', icon: 'queue', title: 'Queue', subtitle: '2 tracks' },
  { key: 'devices', icon: 'computer', title: 'Devices', subtitle: 'DESKTOP-CE9KQ7R' },
  { key: 'bluetooth', icon: 'bluetoothLarge', title: 'Bluetooth', subtitle: 'Pair a phone' },
  { key: 'settings', icon: 'sliders', title: 'Settings', subtitle: 'Display, lyrics, brightness' },
]

const swatch = (from: string, to: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`,
  )

export const FALLBACKS: readonly ArtworkFallback[] = ['none', 'dj', 'liked', 'playlist']

export interface KitRow {
  key: string
  title: string
  subtitle?: string
  art?: string
  icon?: IconName
  value?: string
  tone?: 'danger'
  disabled?: boolean
  pill?: boolean
}

export interface KitData {
  track: { title: string; artist: string }
  arts: readonly string[]
  sections: readonly ListSection<KitRow>[]
}

/** Built on first render rather than at import, so a production build drops all of it. */
export function makeKitData(): KitData {
  const mock = makeMockStatus()
  // the mock art needs the network; the swatches show a crossfade without it
  const arts = [mock.track_image, swatch('#e0527a', '#3a1c71'), swatch('#f7b733', '#fc4a1a')]
  const sections: ListSection<KitRow>[] = [
    {
      key: 'queue',
      title: 'Next in queue',
      items: [
        { key: 'q1', title: mock.track_name, subtitle: mock.track_artist, art: arts[0] },
        { key: 'q2', title: 'Second song', subtitle: 'Someone else', art: arts[1] },
      ],
    },
    {
      key: 'context',
      title: 'Next from Dev Playlist',
      items: [
        { key: 'c1', title: 'A pill row', subtitle: 'variant="pill"', art: arts[2], pill: true },
        { key: 'c2', title: 'No art', subtitle: 'Artwork falls back' },
        { key: 'c3', title: 'A disabled row', subtitle: 'disabled', disabled: true },
      ],
    },
    {
      key: 'settings',
      title: 'Settings rows',
      items: [
        { key: 's1', title: 'Display size', icon: 'displaySize', value: '100%' },
        { key: 's2', title: 'Lyric sync', icon: 'lyrics', value: '+150 ms' },
        { key: 's3', title: 'Reset', icon: 'trash', tone: 'danger' },
      ],
    },
  ]
  return { track: { title: mock.track_name, artist: mock.track_artist }, arts, sections }
}

export const rowKey = (row: KitRow) => row.key
