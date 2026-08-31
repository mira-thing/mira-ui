import type { ObserverStatus, SetupProgress } from '@/api/types'

// which offline screen wins while the daemon has no internet
export type OfflineScreen =
  'checking' | 'tethering' | 'reconnecting' | 'chooser' | 'pc' | 'bluetooth'

export type Route =
  | { kind: 'offline'; screen: OfflineScreen }
  | { kind: 'auth'; url: string }
  | { kind: 'auth-pending'; stuck: boolean }
  | { kind: 'spotify-unreachable' }
  | { kind: 'booting'; stuck: boolean }
  | { kind: 'setting-up'; progress: number | null }
  | { kind: 'idle' }
  | { kind: 'player' }

export interface RouteInput {
  offlineScreen: OfflineScreen | null
  auth: { required: boolean; url: string | null; loading: boolean }
  status: ObserverStatus | null
  setupProgress: SetupProgress | null
  loading: boolean
  online: boolean | null
  /** a drop we expect to recover from; holds the player mounted on the last status */
  reconnecting: boolean
  /** the daemon reports "starting up" while the dealer is (re)connecting */
  playerStartingUp: boolean
  spotifyStuck: boolean
  splashOnlineStuck: boolean
  loadStuck: boolean
}

// Ordered: the first rung that matches wins, and reconnecting suppresses every
// rung below the auth screens so a brief drop never unmounts the player.
export function resolveRoute(input: RouteInput): Route {
  const {
    offlineScreen,
    auth,
    status,
    setupProgress,
    loading,
    online,
    reconnecting,
    playerStartingUp,
    spotifyStuck,
    splashOnlineStuck,
    loadStuck,
  } = input

  if (offlineScreen !== null) return { kind: 'offline', screen: offlineScreen }

  if (auth.required && auth.url) return { kind: 'auth', url: auth.url }

  if (spotifyStuck && splashOnlineStuck && !reconnecting) return { kind: 'spotify-unreachable' }

  const idleOrGone = !status || !status.active

  // hides the starting-up screen on the first boot after a successful bluetooth
  // pairing with pan
  if (!reconnecting && online === true && auth.loading && !auth.url && idleOrGone) {
    return { kind: 'auth-pending', stuck: loadStuck }
  }

  if (!reconnecting && ((loading && !status) || (auth.loading && idleOrGone) || playerStartingUp)) {
    return { kind: 'booting', stuck: loadStuck && online === true && !auth.url }
  }

  // "setting things up" during the FIRST-EVER boot to fetch a library catalog
  if (!reconnecting && status?.setting_up) {
    return { kind: 'setting-up', progress: setupProgress ? setupProgress.percent : null }
  }

  if (!reconnecting && idleOrGone) return { kind: 'idle' }

  return { kind: 'player' }
}
