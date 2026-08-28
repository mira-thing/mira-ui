export interface ObserverStatusInactive {
  active: false
  message?: string
  setting_up?: boolean
  setting_up_progress?: SetupProgress
  // clock offset resolved by the daemon, null until first lookup
  utc_offset_min?: number | null
  checkin_consent?: 'unset' | 'granted' | 'denied' | 'disabled'
  latest_version?: string
  latest_highlights?: string[]
  update_available?: boolean
  update_mandatory?: boolean
}

// first-run library indexing progress ('setup_progress' event + status field)
export interface SetupProgress {
  stage: string
  done: number
  total: number
  percent: number
}

// a selectable spotify connect device
export interface ConnectDevice {
  id: string
  name: string
  type: string
  volume: number
  volume_steps: number
  volume_disabled: boolean
  is_active: boolean
  is_offline: boolean
  can_transfer: boolean
}

// a Spotify playlist (from the daemon's /client/playlists endpoint)
export interface Playlist {
  id: string
  name: string
  uri: string
  image_url: string
  track_count?: number
  owner?: string
}

export interface QueueTrack {
  uri: string
  track_id: string
  name: string
  artist: string
  album: string
  image_url: string
}

export interface ObserverStatusActive {
  active: true
  device_id: string
  device_name: string
  device_type: string
  track_id: string
  track_uri: string
  track_name: string
  track_artist: string
  track_album: string
  track_image: string
  context_uri: string
  context_name: string
  duration: number
  position: number
  is_playing: boolean
  is_paused: boolean
  volume?: number
  volume_max?: number
  volume_disabled?: boolean
  volume_steps?: number
  shuffle: boolean
  repeat_context: boolean
  repeat_track: boolean
  disallow_prev?: boolean
  disallow_next?: boolean
  disallow_seek?: boolean
  prev_tracks?: QueueTrack[]
  next_tracks?: QueueTrack[]
  lyrics_url: string
  raw_metadata?: Record<string, string> | null
  received_at: number
  setting_up?: boolean
  setting_up_progress?: SetupProgress
  utc_offset_min?: number | null
  checkin_consent?: 'unset' | 'granted' | 'denied' | 'disabled'
  latest_version?: string
  latest_highlights?: string[]
  update_available?: boolean
  update_mandatory?: boolean
}

export type ObserverStatus = ObserverStatusActive | ObserverStatusInactive

export interface LyricsWord {
  startTimeMs: string
  word: string
}

export interface LyricsLine {
  startTimeMs: string
  words: string
  syllables?: LyricsWord[]
}

export type LyricsSyncType = 'LINE_SYNCED' | 'UNSYNCED'

export interface LyricsResult {
  syncType: LyricsSyncType
  lines: LyricsLine[]
}

export type ApiEventType =
  | 'observer_track_changed'
  | 'observer_state_changed'
  | 'observer_inactive'
  | 'connect_devices'
  | 'playing'
  | 'paused'
  | 'not_playing'
  | 'seek'
  | 'metadata'
  | 'stopped'
  | 'bluetooth/pairing'
  | 'bluetooth/pairing/cancelled'
  | 'bluetooth/paired'
  | 'bluetooth/connect'
  | 'bluetooth/disconnect'
  | 'bluetooth/network/connect'
  | 'bluetooth/network/disconnect'
  | 'bluetooth/network/unavailable'
  | 'bluetooth/bond-lost'
  | 'network_status'
  | 'voice'
  | 'setup_progress'
  | string

export interface ApiEvent<T = unknown> {
  type: ApiEventType
  data: T
}

// 'voice' event payload
export interface VoiceEventData {
  state: 'listening' | 'thinking' | 'playing' | 'done' | 'error' | 'idle'
  text?: string
}

// must match daemon/bluetooth/types.go
export interface BluetoothDeviceInfo {
  address: string
  name: string
  alias: string
  class: string
  icon: string
  paired: boolean
  trusted: boolean
  blocked: boolean
  connected: boolean
  legacyPairing: boolean
  batteryPercentage?: number
}

// must match daemon/bluetooth/known_devices.go
export interface KnownBluetoothDevice {
  address: string
  name: string
  starred: boolean
  last_connected: string
  connected: boolean
  network: boolean
}

export interface PairingStartedPayload {
  address: string
  pairingKey: string
}

export interface DevicePairedPayload {
  device: BluetoothDeviceInfo
}

export interface DeviceConnectedPayload {
  address: string
  device?: BluetoothDeviceInfo
}

export interface DeviceDisconnectedPayload {
  address: string
}

export interface NetworkConnectedPayload {
  address: string
}

export interface NetworkStatusPayload {
  status: 'online' | 'offline'
  // which physical links are up
  usb?: boolean
  bt?: boolean
}

// PascalCase shape on the /events WS for observer events
export interface RemoteStateWire {
  DeviceId: string
  DeviceName: string
  DeviceType: string
  TrackUri: string
  TrackName: string
  TrackArtist: string
  TrackAlbum: string
  TrackImageUrl: string
  ContextUri: string
  ContextName: string
  Duration: number
  PositionAsOfTimestamp: number
  Timestamp: number
  Position?: number
  IsPlaying: boolean
  IsPaused: boolean
  PlaybackSpeed: number
  Volume?: number
  VolumeDisabled?: boolean
  VolumeSteps?: number
  ShuffleContext: boolean
  RepeatContext: boolean
  RepeatTrack: boolean
  DisallowSkipPrev?: boolean
  DisallowSkipNext?: boolean
  DisallowSeek?: boolean
  PrevTracks?: QueueTrack[]
  NextTracks?: QueueTrack[]
  RawMetadata?: Record<string, string> | null
}

// debug screen snapshot
export interface DebugStatus {
  firmware_version: string
  daemon_version: string
  uptime_secs: number
  daemon_uptime_secs: number
  clock_time: string
  clock_ok: boolean
  ram_free_mb: number
  ram_total_mb: number
  disk_free_mb: number
  temp_c: number
  load_1m: string
  ws_clients: number
  online: boolean
  network_path: string
  ip: string
  dns_servers: number
  usb_bounces: number
  internet_drops: number
  tether_health: string
  spotify: string
  bluetooth_device: string
  phone_volume: string
  phone_volume_err: string
  android_volume: string
  voice_enabled: boolean
  voice_ready: boolean
  recent_problems: string[]
  previous_problems: string[]
}
