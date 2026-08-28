import { useSyncExternalStore } from 'react'
import { API_BASE } from '@/config'
import type { PresetConfig } from '@/presets'

// preferences for volume, offset, brightness store
// settings are all given by the daemon

export interface Settings {
  showLyrics: boolean
  karaokeLyrics: boolean
  lyricOffsetMs: number
  volumeStepPct: number
  autoBrightness: boolean
  brightness: number
  voiceMic: boolean
  uiScalePct: number
  timezoneMode: 'auto' | 'manual'
  utcOffsetMinutes: number
  timeFormat: '12h' | '24h'
  presets: Record<number, PresetConfig>
  checkinConsent: '' | 'granted' | 'denied'
}

export const VOLUME_STEP_MIN = 1
export const VOLUME_STEP_MAX = 10
export const BRIGHTNESS_MIN = 1
export const BRIGHTNESS_MAX = 10
export const UI_SCALE_MIN = 85
export const UI_SCALE_MAX = 115
export const UI_SCALE_STEP = 5
export const UI_SCALE_DEFAULT = 100

const SCHEMA_VERSION = 1
const LS_KEY = 'mira.settings.v1'
const PUT_DEBOUNCE_MS = 400

const DEFAULTS: Settings = {
  showLyrics: true,
  karaokeLyrics: true,
  lyricOffsetMs: 0,
  volumeStepPct: 2,
  autoBrightness: true,
  brightness: 5,
  voiceMic: true,
  uiScalePct: UI_SCALE_DEFAULT,
  timezoneMode: 'auto',
  utcOffsetMinutes: 0,
  timeFormat: '24h',
  presets: {},
  checkinConsent: '',
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// the ui scale feeds arithmetic that ends up as a css length, and initSettings replaces
// the store wholesale from the daemon's opaque blob. a NaN here would render as "NaNpx"
// and take the lyrics drag math with it, so reject anything non-finite and snap to a notch
function coerceUiScale(raw: unknown): number {
  // Number(null) and Number('') are both 0, which would silently clamp to the minimum
  // rather than fall back, so only numbers and non-blank numeric strings get through
  const n =
    typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return DEFAULTS.uiScalePct
  return clamp(Math.round(n / UI_SCALE_STEP) * UI_SCALE_STEP, UI_SCALE_MIN, UI_SCALE_MAX)
}

function coerce(partial: Partial<Settings> | null | undefined): Settings {
  return {
    showLyrics: partial?.showLyrics ?? DEFAULTS.showLyrics,
    karaokeLyrics: partial?.karaokeLyrics ?? DEFAULTS.karaokeLyrics,
    lyricOffsetMs: partial?.lyricOffsetMs ?? DEFAULTS.lyricOffsetMs,
    volumeStepPct: clamp(
      partial?.volumeStepPct ?? DEFAULTS.volumeStepPct,
      VOLUME_STEP_MIN,
      VOLUME_STEP_MAX,
    ),
    autoBrightness: partial?.autoBrightness ?? DEFAULTS.autoBrightness,
    brightness: clamp(partial?.brightness ?? DEFAULTS.brightness, BRIGHTNESS_MIN, BRIGHTNESS_MAX),
    voiceMic: partial?.voiceMic ?? DEFAULTS.voiceMic,
    uiScalePct: coerceUiScale(partial?.uiScalePct),
    timezoneMode: partial?.timezoneMode === 'manual' ? 'manual' : 'auto',
    utcOffsetMinutes: coerceOffset(partial?.utcOffsetMinutes),
    timeFormat: partial?.timeFormat === '12h' ? '12h' : '24h',
    presets: partial?.presets ?? {},
    checkinConsent:
      partial?.checkinConsent === 'granted' || partial?.checkinConsent === 'denied'
        ? partial.checkinConsent
        : DEFAULTS.checkinConsent,
  }
}

// the clock is set to UTC on the device; allow a manual offset of
// -12h..+14h in 15-minute steps (matches real-world timezones)
const OFFSET_MIN = -720
const OFFSET_MAX = 840
const OFFSET_STEP = 15
function coerceOffset(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return DEFAULTS.utcOffsetMinutes
  return Math.round(Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, n)) / OFFSET_STEP) * OFFSET_STEP
}

function readLocal(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return coerce(JSON.parse(raw) as Partial<Settings>)
  } catch {
    // ignore
  }
  return coerce(null)
}

let current: Settings = readLocal()

const listeners = new Set<() => void>()
function emit(): void {
  for (const l of listeners) l()
}

function writeLocal(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(current))
  } catch {
    // ignore
  }
}

let putTimer = 0
function schedulePut(): void {
  window.clearTimeout(putTimer)
  putTimer = window.setTimeout(() => void putSettings(current), PUT_DEBOUNCE_MS)
}

async function putSettings(s: Settings): Promise<void> {
  try {
    await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ v: SCHEMA_VERSION, ...s }),
    })
  } catch {
    // offline/daemon busy
  }
}

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch }
  writeLocal()
  emit()
  schedulePut()
}

export function subscribeSettings(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, () => current)
}

// check with the daemon once at startup
let initialized = false
export async function initSettings(): Promise<void> {
  if (initialized) return
  initialized = true
  try {
    const res = await fetch(`${API_BASE}/settings`)
    if (!res.ok) return
    const data = (await res.json()) as (Partial<Settings> & { v?: number }) | null
    if (data && typeof data.v === 'number') {
      current = coerce(data)
      writeLocal()
      emit()
    } else {
      // daemon never seeded
      void putSettings(current)
    }
  } catch {
    // offline
  }
}

// test-only
export function __resetSettings(): void {
  initialized = false
  current = readLocal()
  emit()
}
