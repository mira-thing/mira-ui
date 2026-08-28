import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEV_SCREENS_ENABLED,
  DevScreenContext,
  type DevForcedScreen,
  useDevScreen,
} from './devContext'
import styles from './DevScreens.module.scss'

const STORAGE_KEY = 'mira.dev.forcedScreen'

function readStored(): DevForcedScreen {
  if (!DEV_SCREENS_ENABLED) return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (!v || v === 'null') return null
    return v as DevForcedScreen
  } catch {
    return null
  }
}

function writeStored(v: DevForcedScreen) {
  try {
    if (v) window.localStorage.setItem(STORAGE_KEY, v)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function DevScreenProvider({ children }: { children: ReactNode }) {
  const [forced, setForcedRaw] = useState<DevForcedScreen>(() => readStored())

  // Persist across HMR
  const value = useMemo(
    () => ({
      forced,
      setForced: (s: DevForcedScreen) => {
        writeStored(s)
        setForcedRaw(s)
      },
    }),
    [forced],
  )

  if (!DEV_SCREENS_ENABLED) return <>{children}</>

  return <DevScreenContext.Provider value={value}>{children}</DevScreenContext.Provider>
}

interface ScreenDef {
  id: Exclude<DevForcedScreen, null>
  label: string
  hint?: string
}

const SCREENS: ScreenDef[] = [
  { id: 'connection-chooser', label: 'Connection chooser', hint: 'PC/Bluetooth picker' },
  { id: 'pc-connect', label: 'PC connect', hint: 'USB tethering sub-screen' },
  { id: 'needs-network', label: 'Bluetooth connect', hint: 'BT pairing sub-screen' },
  { id: 'boot-splash', label: 'Boot splash', hint: 'Animated brand splash' },
  { id: 'starting', label: 'Starting up', hint: 'Boot splash w/ caption' },
  { id: 'setting-up', label: 'Setting up', hint: 'First-run indexing w/ progress bar' },
  { id: 'auth', label: 'Auth (QR code)', hint: 'OAuth pairing screen' },
  { id: 'idle', label: 'Idle (no playback)' },
  { id: 'idle-clock', label: 'Idle: clock', hint: 'Clock screen before device picker' },
  { id: 'playing-lyrics', label: 'Playing: lyrics' },
  { id: 'playing-no-lyrics', label: 'Playing: no lyrics' },
  { id: 'pairing', label: 'Pairing dialog', hint: 'Over the player view' },
  { id: 'menu', label: 'Menu open', hint: 'Bottom-sheet over player' },
  { id: 'power-menu', label: 'Power menu', hint: 'Sleep/Restart/Reset (tap Reset for confirm)' },
  {
    id: 'bluetooth-menu',
    label: 'Bluetooth menu',
    hint: 'Known devices / pair (live daemon list)',
  },
  { id: 'settings', label: 'Settings', hint: 'Lyric sync / volume / brightness / display size' },
  {
    id: 'reconnecting',
    label: 'Reconnecting screen',
    hint: 'Phone out of range (no stale player)',
  },
  { id: 'no-internet', label: 'No internet (prolonged)', hint: 'Reconnecting escalated + Restart' },
  { id: 'checking', label: 'Checking connection', hint: 'Grace splash before no-internet' },
  { id: 'reconnect-banner', label: 'Reconnect banner', hint: 'Transient drop over the player' },
  { id: 'debug', label: 'Debug screen', hint: 'Diagnostics (hold presets 1+4 on device)' },
  { id: 'sponsor', label: 'Sponsor screen', hint: 'One-time support QR after setup' },
  { id: 'playlists', label: 'Playlists', hint: 'Full-screen playlist library (double-press back)' },
  { id: 'screensaver', label: 'Screensaver', hint: 'Clock over ambient art (double power press)' },
  { id: 'consent', label: 'Consent card', hint: 'First-boot telemetry choice, right after setup' },
  { id: 'update-card', label: 'Update card', hint: 'New release nag on the idle screen' },
]

export function DevOverlay() {
  const { forced, setForced } = useDevScreen()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!DEV_SCREENS_ENABLED) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inEditable =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (inEditable) return

      if (e.key === 't' && !e.repeat) {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (open && e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!DEV_SCREENS_ENABLED) return null

  const badge =
    !open && forced ? (
      <button
        type="button"
        className={styles.badge}
        onClick={() => setOpen(true)}
        title="Open dev screens (t)"
      >
        DEV - {forced}
      </button>
    ) : null

  if (!open) return badge

  return (
    <div className={styles.scrim} onClick={() => setOpen(false)} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Dev screens"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.title}>Dev screens</span>
          <span className={styles.kbd}>t to toggle</span>
        </div>

        <div className={styles.list}>
          <button
            type="button"
            className={`${styles.row} ${forced === null ? styles.rowActive : ''}`}
            onClick={() => {
              setForced(null)
              setOpen(false)
            }}
          >
            <span className={styles.rowMark}>{forced === null ? '->' : ''}</span>
            <span className={styles.rowLabel}>Reset (live state)</span>
            <span className={styles.rowHint}>Stop overriding</span>
          </button>

          <div className={styles.divider} aria-hidden />

          {SCREENS.map((s) => {
            const active = forced === s.id
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.row} ${active ? styles.rowActive : ''}`}
                onClick={() => {
                  setForced(s.id)
                  setOpen(false)
                }}
              >
                <span className={styles.rowMark}>{active ? '->' : ''}</span>
                <span className={styles.rowLabel}>{s.label}</span>
                <span className={styles.rowHint}>{s.hint ?? ''}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
