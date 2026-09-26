import type { ObserverStatusActive } from '@/api/types'

// mock playback state used by the dev screen switcher
export function makeMockStatus(): ObserverStatusActive {
  const env = import.meta.env
  const trackId = env.VITE_MOCK_TRACK_ID ?? ''
  return {
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
}
