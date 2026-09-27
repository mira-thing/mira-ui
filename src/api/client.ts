import { API_BASE, WS_URL } from '@/config'
import type {
  ConnectDevice,
  DebugStatus,
  LyricsResult,
  ObserverStatus,
  ObserverStatusActive,
  RemoteStateWire,
} from './types'

function trackIdFromUri(uri: string): string {
  const parts = uri.split(':')
  return parts.length === 3 ? parts[2] : ''
}

const MAX_POSITION_PROJECTION_MS = 10 * 60 * 1000

export function remoteStateToStatus(rs: RemoteStateWire): ObserverStatusActive {
  const trackId = trackIdFromUri(rs.TrackUri)
  const now = Date.now()
  // Prefer the daemons position
  let position: number
  if (typeof rs.Position === 'number') {
    position = Math.min(rs.Duration, rs.Position)
  } else {
    const rawElapsed = rs.Timestamp > 0 ? now - rs.Timestamp : 0
    const elapsed =
      rs.IsPlaying && !rs.IsPaused && rawElapsed >= 0 && rawElapsed <= MAX_POSITION_PROJECTION_MS
        ? rawElapsed
        : 0
    position = Math.min(rs.Duration, rs.PositionAsOfTimestamp + elapsed)
  }

  return {
    active: true,
    device_id: rs.DeviceId,
    device_name: rs.DeviceName,
    device_type: rs.DeviceType,
    track_id: trackId,
    track_uri: rs.TrackUri,
    track_name: rs.TrackName,
    track_artist: rs.TrackArtist,
    track_album: rs.TrackAlbum,
    track_image: rs.TrackImageUrl,
    context_uri: rs.ContextUri,
    context_name: rs.ContextName ?? '',
    duration: rs.Duration,
    position,
    is_playing: rs.IsPlaying,
    is_paused: rs.IsPaused,
    volume: rs.Volume,
    volume_max: 65535,
    volume_disabled: rs.VolumeDisabled,
    volume_steps: rs.VolumeSteps,
    shuffle: rs.ShuffleContext,
    repeat_context: rs.RepeatContext,
    repeat_track: rs.RepeatTrack,
    disallow_prev: rs.DisallowSkipPrev,
    disallow_next: rs.DisallowSkipNext,
    disallow_seek: rs.DisallowSeek,
    prev_tracks: rs.PrevTracks,
    next_tracks: rs.NextTracks,
    lyrics_url: trackId ? `/lyrics/${trackId}` : '',
    raw_metadata: rs.RawMetadata ?? null,
    received_at: now,
  }
}

// chrome 69's gc doesn't count res.json() strings, so polls piled up until a gc that never ran
export async function readJson(res: Response): Promise<unknown> {
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192) as unknown as number[])
  }
  return JSON.parse(decodeURIComponent(escape(binary)))
}

export async function fetchObserverStatus(signal?: AbortSignal): Promise<ObserverStatus> {
  const res = await fetch(`${API_BASE}/observer/status`, { signal, cache: 'no-store' })
  if (res.status === 204) return { active: false, message: 'no session' }
  if (!res.ok) throw new Error(`observer/status ${res.status}`)
  const body = (await readJson(res)) as ObserverStatusActive | ObserverStatus
  if (body && body.active === true) {
    return { ...(body as Omit<ObserverStatusActive, 'received_at'>), received_at: Date.now() }
  }
  return body as ObserverStatus
}

export async function fetchDebugStatus(signal?: AbortSignal): Promise<DebugStatus> {
  const res = await fetch(`${API_BASE}/debug/status`, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`debug/status ${res.status}`)
  return (await res.json()) as DebugStatus
}

// uploads the support bundle via the daemon
export async function sendDebugReport(signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${API_BASE}/debug/report`, { method: 'POST', signal })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || `debug/report ${res.status}`)
  if (!body?.id) throw new Error('no report id')
  return body.id as string
}

export async function fetchConnectDevices(signal?: AbortSignal): Promise<ConnectDevice[]> {
  const res = await fetch(`${API_BASE}/connect/devices`, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`connect/devices ${res.status}`)
  const body = await res.json()
  return Array.isArray(body?.devices) ? (body.devices as ConnectDevice[]) : []
}

// resume playback on the last active device (used from the idle screen). Throws
// on non-OK (404 = no remembered/available device) so the caller can banner it.
export async function resumeLastDevice(): Promise<void> {
  const res = await fetch(`${API_BASE}/player/resume_last`, { method: 'POST' })
  if (!res.ok) throw new Error(`player/resume_last ${res.status}`)
}

// transfer the current playback session to another device
export async function transferToDevice(deviceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/connect/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId }),
  })
  if (!res.ok) throw new Error(`connect/transfer ${res.status}`)
}

export async function fetchLyrics(
  trackId: string,
  meta: {
    track: string
    artist: string
    album?: string
    durationMs?: number
    episode?: boolean
    richsync?: boolean
  },
  signal?: AbortSignal,
): Promise<LyricsResult | null> {
  const params = new URLSearchParams({
    track: meta.track,
    artist: meta.artist,
  })
  if (meta.album) params.set('album', meta.album)
  if (meta.durationMs && meta.durationMs > 0) params.set('duration', String(meta.durationMs))
  // route to the podcast-transcript source on the daemon
  if (meta.episode) params.set('episode', '1')
  // word by word timing
  if (meta.richsync) params.set('richsync', '1')

  const res = await fetch(`${API_BASE}/lyrics/${encodeURIComponent(trackId)}?${params}`, { signal })
  // 404 means nothing was found (instrumental or too niche)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`lyrics ${res.status}`)
  return (await res.json()) as LyricsResult
}

// whether the given track is in the liked songs
export async function fetchSavedState(uri: string, signal?: AbortSignal): Promise<boolean> {
  const res = await fetch(`${API_BASE}/player/saved?uri=${encodeURIComponent(uri)}`, {
    signal,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`player/saved ${res.status}`)
  const body = await res.json()
  return body?.saved === true
}

// add or remove the track from liked songs
export async function setSavedState(uri: string, saved: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/player/saved`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri, saved }),
  })
  if (!res.ok) throw new Error(`player/saved ${res.status}`)
}

export function eventsUrl(): string {
  return WS_URL
}
