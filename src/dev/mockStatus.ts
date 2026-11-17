import type { ObserverStatusActive, QueueTrack } from '@/api/types'
import { DJ_PLAYLIST_URI, type DJNarration } from '@/hooks/useDJNarration'

export type MockStatusKind = 'track' | 'no-art' | 'dj'

// what useDJNarration reports while the DJ talks over the mock DJ set
export const MOCK_NARRATION: DJNarration = { narrating: true, title: 'Up next', artist: 'DJ X' }

const mockNext = (n: number, name: string, artist: string, image_url: string): QueueTrack => ({
  uri: `spotify:track:mock-next-${n}`,
  track_id: `mock-next-${n}`,
  name,
  artist,
  album: 'Dev Album',
  image_url,
})

// a repeat and a missing cover, so the dev queue shows both edge cases
function mockUpNext(art: string): QueueTrack[] {
  return [
    mockNext(1, 'Neon Harbour', 'Glass Animals of Tin', art),
    mockNext(2, 'Slow Weather', 'Mira Ensemble', ''),
    mockNext(3, 'Paper Satellites', 'The Overpass', art),
    mockNext(1, 'Neon Harbour', 'Glass Animals of Tin', art),
    mockNext(4, 'Afterglow Drive', 'Night Transit', art),
    mockNext(5, 'Low Tide Signals', 'Coastline Radio', art),
  ]
}

// mock playback state used by the dev screen switcher
export function makeMockStatus(kind: MockStatusKind = 'track'): ObserverStatusActive {
  const env = import.meta.env
  const trackId = env.VITE_MOCK_TRACK_ID ?? ''
  const status: ObserverStatusActive = {
    active: true,
    device_id: 'dev-mock',
    device_name: 'Dev Mock',
    device_type: 'COMPUTER',
    track_id: trackId || 'mock-track-1',
    track_uri: env.VITE_MOCK_TRACK_URI ?? 'spotify:track:mock',
    track_name: env.VITE_MOCK_TRACK_NAME ?? 'Reka',
    track_artist: env.VITE_MOCK_TRACK_ARTIST ?? 'Tap 011',
    track_album: env.VITE_MOCK_TRACK_ALBUM ?? 'Top Mix Devedesete, Vol. 1',
    track_image:
      env.VITE_MOCK_TRACK_IMAGE ??
      'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ac/8b/a1/ac8ba15e-49f2-9022-0129-cfe055aa62ca/5979.jpg/600x600bb.jpg',
    context_uri: env.VITE_MOCK_CONTEXT_URI ?? 'spotify:playlist:dev-mock',
    context_name: env.VITE_MOCK_CONTEXT_NAME ?? 'Dev Playlist',
    duration: Number(env.VITE_MOCK_DURATION ?? 200000),
    position: Number(env.VITE_MOCK_POSITION ?? 60000),
    is_playing: true,
    is_paused: false,
    shuffle: false,
    repeat_context: false,
    repeat_track: false,
    lyrics_url: trackId ? `/lyrics/${trackId}` : '',
    raw_metadata: null,
    received_at: Date.now(),
  }
  status.next_tracks = mockUpNext(status.track_image)
  if (kind === 'no-art') return { ...status, track_image: '', next_tracks: mockUpNext('') }
  if (kind === 'dj') {
    return {
      ...status,
      context_uri: DJ_PLAYLIST_URI,
      context_name: 'DJ',
      raw_metadata: { agentic_product_type: 'dj' },
    }
  }
  return status
}
