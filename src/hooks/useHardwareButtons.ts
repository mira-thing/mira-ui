import { useCallback, useEffect, useRef, useState } from 'react'
import type { ObserverStatusActive } from '@/api/types'
import {
  getPreset,
  isDJPreset,
  presetForContext,
  presetIndexFromCode,
  refreshPresetLabels,
  setPreset,
} from '@/presets'
import { getSettings } from '@/settings'
import type { NotifyFn } from '@/notify/notifyContext'

// physical controls

const VOLUME_MAX = 65535

// quadrature encoder wheel so its two contact pads sometimes send erronious signals still ever after a kernal level change
// volume change per notch is user-adjustable now

const VOLUME_DIRECTION = -1

// drop events that are close together by this much
const MIN_STEP_INTERVAL_MS = 55

// similar idea
const REVERSAL_DEBOUNCE_MS = 140

const OVERLAY_MS = 1400

// throttle the "can't control volume" banner
const DISABLED_VOLUME_NOTIFY_MS = 4000

// for the local optimistic value
const INTERACTION_GRACE_MS = 1500

const SEND_THROTTLE_MS = 80

export interface UseHardwareButtonsParams {
  // observer status
  status: ObserverStatusActive | null
  onPlayPause: () => void
  // set device volume
  setVolume: (volume: number, relative?: boolean) => Promise<void> | void
  // play a context (used by preset buttons)
  playContext: (uri: string) => Promise<void> | void
  // a DJ set is playing: a long-press saves the slot as DJ, and a short press on a DJ slot
  // becomes a retry rather than a fresh start
  inDJSet: boolean
  // the DJ is mid-sentence, so the retry is ignored
  djNarrating: boolean
  // ask the DJ for a different set
  onDJSignal: () => void
  // back button (esc), go back one step, or no-op
  onBack: () => void
  // back button double-press: open the playlists picker
  onOpenPlaylists: () => void
  // power button (KeyM): short press opens the power menu
  onTogglePowerMenu: () => void
  // power button double-press: opens the clock screensaver
  onScreensaver: () => void
  // hold preset 1 + 4 together for 3s: open the debug screen
  onOpenDebug: () => void
  // top banner message for playlist msgs
  notify: NotifyFn
}

// hold a preset this long to save the current context
const PRESET_HOLD_MS = 2000

// hold preset 1 + 4 together this long to open the debug screen
const CHORD_MS = 3000

// power button: a press held longer than this is ignored (no long-press action yet?)
const POWER_LONG_PRESS_MS = 600
// power button: a second press within this window counts as a double-press
const POWER_DOUBLE_MS = 350

// back button: a second press within this window opens the playlists
const BACK_DOUBLE_MS = 350

export interface VolumeOverlayState {
  visible: boolean
  value: number
  // true when the active device refuses remote volume like a phone
  disabled: boolean
  phone?: boolean
  dir?: 1 | -1
}

export interface UseHardwareButtonsResult {
  volumeOverlay: VolumeOverlayState
}

export function useHardwareButtons({
  status,
  onPlayPause,
  setVolume,
  playContext,
  inDJSet,
  djNarrating,
  onDJSignal,
  onBack,
  onOpenPlaylists,
  onTogglePowerMenu,
  onScreensaver,
  onOpenDebug,
  notify,
}: UseHardwareButtonsParams): UseHardwareButtonsResult {
  const [volumeOverlay, setVolumeOverlay] = useState<VolumeOverlayState>({
    visible: false,
    value: 0,
    disabled: false,
  })

  const volumeRef = useRef(0)
  const lastTurnAtRef = useRef(0)
  const overlayTimerRef = useRef<number | undefined>(undefined)
  const sendTimerRef = useRef<number | undefined>(undefined)
  const pendingSendRef = useRef<number | null>(null)
  const lastStepAtRef = useRef(0)
  const lastStepDirRef = useRef<1 | -1>(1)
  const lastDisabledNotifyRef = useRef(0)

  const statusVolume = status?.volume
  const volumeDisabled = status?.volume_disabled ?? false

  const volumeDisabledRef = useRef(volumeDisabled)
  volumeDisabledRef.current = volumeDisabled
  const statusRef = useRef(status)
  statusRef.current = status
  const djRef = useRef({ inSet: inDJSet, narrating: djNarrating, signal: onDJSignal })
  djRef.current = { inSet: inDJSet, narrating: djNarrating, signal: onDJSignal }

  const contextUri = status?.context_uri
  const contextName = status?.context_name
  useEffect(() => {
    if (contextUri && contextName) refreshPresetLabels(contextUri, contextName)
  }, [contextUri, contextName])

  // sync volume from the device when not mid turn
  useEffect(() => {
    if (typeof statusVolume !== 'number') return
    if (Date.now() - lastTurnAtRef.current < INTERACTION_GRACE_MS) return
    volumeRef.current = statusVolume
  }, [statusVolume])

  const queueSend = useCallback(
    (v: number) => {
      pendingSendRef.current = v
      if (sendTimerRef.current != null) return
      sendTimerRef.current = window.setTimeout(() => {
        sendTimerRef.current = undefined
        if (pendingSendRef.current == null) return
        const send = pendingSendRef.current
        pendingSendRef.current = null
        // swallow quietly
        void Promise.resolve(setVolume(send, false)).catch(() => {})
      }, SEND_THROTTLE_MS)
    },
    [setVolume],
  )

  const showOverlay = useCallback(
    (value01: number, disabled: boolean, extra?: Pick<VolumeOverlayState, 'phone' | 'dir'>) => {
      setVolumeOverlay({ visible: true, value: value01, disabled, ...extra })
      if (overlayTimerRef.current != null) window.clearTimeout(overlayTimerRef.current)
      overlayTimerRef.current = window.setTimeout(() => {
        setVolumeOverlay((o) => ({ ...o, visible: false }))
      }, OVERLAY_MS)
    },
    [],
  )

  // one knob click is one volume step.
  const stepVolume = useCallback(
    (dir: 1 | -1) => {
      if (volumeDisabledRef.current) {
        showOverlay(dir > 0 ? 1 : 0.2, false, { phone: true, dir })
        void Promise.resolve(setVolume(dir, true)).catch(() => {
          setVolumeOverlay((o) => ({ ...o, visible: false }))
          const now = Date.now()
          if (now - lastDisabledNotifyRef.current > DISABLED_VOLUME_NOTIFY_MS) {
            lastDisabledNotifyRef.current = now
            notify('Cannot control volume on this device', { variant: 'warning' })
          }
        })
        return
      }
      // user adjustable
      const step = Math.max(1, Math.round((getSettings().volumeStepPct / 100) * VOLUME_MAX))
      const next = Math.max(0, Math.min(VOLUME_MAX, volumeRef.current + dir * step))
      volumeRef.current = next
      showOverlay(next / VOLUME_MAX, false)
      queueSend(next)
    },
    [showOverlay, queueSend, notify, setVolume],
  )

  // knob turn -> volume only when something is playing
  useEffect(() => {
    if (!status) return

    const onWheel = (e: WheelEvent) => {
      // the knob is REL_HWHEEL -> horizontal deltaX
      if (e.deltaX === 0) return
      e.preventDefault()

      const now = Date.now()
      lastTurnAtRef.current = now
      const dir: 1 | -1 = (e.deltaX > 0 ? 1 : -1) * VOLUME_DIRECTION > 0 ? 1 : -1
      const sinceStep = now - lastStepAtRef.current

      if (dir !== lastStepDirRef.current && sinceStep < REVERSAL_DEBOUNCE_MS) return
      if (sinceStep < MIN_STEP_INTERVAL_MS) return

      lastStepAtRef.current = now
      lastStepDirRef.current = dir
      stepVolume(dir)
    }

    // capture phase + window so a lyrics cant scroll from the wheel
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', onWheel, { capture: true })
  }, [status, stepVolume])

  // knob press (Enter) is play/pause, back (Escape) is go back.
  // A second back press within BACK_DOUBLE_MS opens the playlists instead.
  // preventDefault so Enter doesnt also trigger a focused button like the menu.
  useEffect(() => {
    let backAt = 0
    let pendingBack: number | undefined
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onPlayPause()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        const now = Date.now()
        if (now - backAt <= BACK_DOUBLE_MS) {
          // double press -> playlists
          backAt = 0
          if (pendingBack != null) {
            window.clearTimeout(pendingBack)
            pendingBack = undefined
          }
          onOpenPlaylists()
        } else {
          backAt = now
          if (pendingBack != null) window.clearTimeout(pendingBack)
          pendingBack = window.setTimeout(() => {
            pendingBack = undefined
            onBack()
          }, BACK_DOUBLE_MS)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (pendingBack != null) window.clearTimeout(pendingBack)
    }
  }, [onPlayPause, onBack, onOpenPlaylists])

  // preset buttons
  // short press = play the assigned context
  // hold for 2s = save current context to the slot
  useEffect(() => {
    const holdTimers: Record<string, number> = {}
    const saved: Record<string, boolean> = {}
    const down: Record<string, boolean> = {}
    let chordTimer: number | undefined

    const chordCodes = ['Digit1', 'Digit4']
    const bothChordDown = () => chordCodes.every((c) => down[c])
    const clearChord = () => {
      if (chordTimer != null) {
        window.clearTimeout(chordTimer)
        chordTimer = undefined
      }
    }

    const saveCurrentToPreset = (idx: number) => {
      const cur = statusRef.current
      if (cur && cur.context_uri) {
        const config = presetForContext(cur.context_uri, cur.context_name, djRef.current.inSet)
        setPreset(idx, config)
        notify(`Saved "${config.label}" to preset ${idx}`, { variant: 'success' })
      } else {
        notify('Nothing playing to save', { variant: 'warning' })
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const idx = presetIndexFromCode(e.code)
      if (idx == null) return
      if (e.repeat) return
      down[e.code] = true
      if (holdTimers[e.code] == null) {
        saved[e.code] = false
        holdTimers[e.code] = window.setTimeout(() => {
          holdTimers[e.code] = undefined as unknown as number
          saved[e.code] = true // suppress the play on release
          saveCurrentToPreset(idx)
        }, PRESET_HOLD_MS)
      }
      if (chordCodes.includes(e.code) && bothChordDown() && chordTimer == null) {
        for (const c of chordCodes) {
          if (holdTimers[c] != null) {
            window.clearTimeout(holdTimers[c])
            holdTimers[c] = undefined as unknown as number
          }
          saved[c] = true
        }
        chordTimer = window.setTimeout(() => {
          chordTimer = undefined
          onOpenDebug()
        }, CHORD_MS)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const idx = presetIndexFromCode(e.code)
      if (idx == null) return
      down[e.code] = false
      if (chordCodes.includes(e.code)) clearChord()
      if (holdTimers[e.code] != null) {
        window.clearTimeout(holdTimers[e.code])
        holdTimers[e.code] = undefined as unknown as number
      }
      if (saved[e.code]) {
        saved[e.code] = false
        return // hold already saved dont also play
      }
      const preset = getPreset(idx)
      const dj = djRef.current
      // a DJ slot is a retry once a set is playing: `jump` is what asks for a different set,
      // and replaying the context appears to resume the current one instead. Ignored
      // mid-narration, matching the on-screen DJ button
      if (isDJPreset(preset) && dj.inSet) {
        if (!dj.narrating) {
          dj.signal()
          notify('Switching DJ set')
        }
        return
      }
      // short press will play the assigned context, cold-starting DJ like any other
      if (preset?.contextUri) {
        // only claim success once the play actually lands
        void Promise.resolve(playContext(preset.contextUri))
          .then(() => notify(`Playing from ${preset.label}`))
          .catch(() => notify(`Couldn't play ${preset.label}`, { variant: 'error' }))
      }
      // unassigned slots (2-4 until saved) just do nothing
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      for (const t of Object.values(holdTimers)) if (t != null) window.clearTimeout(t)
      clearChord()
    }
  }, [playContext, notify, onOpenDebug])

  // power button controls
  useEffect(() => {
    let downAt = 0
    let armed = false
    let pendingSingle: number | undefined
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM') return
      if (e.repeat) return
      downAt = Date.now()
      armed = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM') return
      // only count a keyup that had a matching keydown
      if (!armed) return
      armed = false
      const held = downAt ? Date.now() - downAt : 0
      downAt = 0
      // a deliberate hold does nothing yet?
      if (held >= POWER_LONG_PRESS_MS) return
      if (pendingSingle != null) {
        // second tap within the window -> double press -> screensaver
        window.clearTimeout(pendingSingle)
        pendingSingle = undefined
        onScreensaver()
      } else {
        pendingSingle = window.setTimeout(() => {
          pendingSingle = undefined
          onTogglePowerMenu()
        }, POWER_DOUBLE_MS)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      if (pendingSingle != null) window.clearTimeout(pendingSingle)
    }
  }, [onTogglePowerMenu, onScreensaver])

  // clean up timers
  useEffect(
    () => () => {
      if (overlayTimerRef.current != null) window.clearTimeout(overlayTimerRef.current)
      if (sendTimerRef.current != null) window.clearTimeout(sendTimerRef.current)
    },
    [],
  )

  return { volumeOverlay }
}
