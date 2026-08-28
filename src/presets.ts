// Physical preset buttons (Digit1-4 on the Car Thing).
//
// Short press plays the slot's context, long press saves the context of whatever is playing
// Preset 1 defaults to Liked Songs, 2-4 start empty.
// DJ is stored as its playlist uri like any other context, but the press does one of two
// things: with no set playing the daemon starts one from that uri, and with a set already
// playing the press is a retry that asks the DJ for a different one.

import { DJ_PLAYLIST_URI } from '@/hooks/useDJNarration'
import { getSettings, updateSettings } from '@/settings'

export interface PresetConfig {
  contextUri: string | null
  label: string
}

// Liked songs context
const DEFAULTS: Record<number, PresetConfig> = {
  1: { contextUri: 'spotify:collection:tracks', label: 'Liked Songs' },
  2: { contextUri: null, label: 'Preset 2' },
  3: { contextUri: null, label: 'Preset 3' },
  4: { contextUri: null, label: 'Preset 4' },
}

export function getPreset(index: number): PresetConfig | null {
  return getSettings().presets[index] ?? DEFAULTS[index] ?? null
}

// called on long-press to assign the currently-playing context to a slot
export function setPreset(index: number, config: PresetConfig): void {
  updateSettings({ presets: { ...getSettings().presets, [index]: config } })
}

function isDJUri(uri: string | null | undefined): boolean {
  return uri === DJ_PLAYLIST_URI
}

export function isDJPreset(preset: PresetConfig | null): boolean {
  return isDJUri(preset?.contextUri)
}

export function presetForContext(
  contextUri: string,
  contextName: string,
  inDJSet: boolean,
): PresetConfig {
  if (inDJSet || isDJUri(contextUri)) return { contextUri: DJ_PLAYLIST_URI, label: 'DJ' }
  return { contextUri, label: contextName || labelFromUri(contextUri) }
}

export function refreshPresetLabels(contextUri: string, contextName: string): void {
  if (!contextUri || !contextName || isDJUri(contextUri)) return
  const presets = getSettings().presets
  let next: Record<number, PresetConfig> | null = null
  for (const [slot, preset] of Object.entries(presets)) {
    if (preset.contextUri !== contextUri || preset.label === contextName) continue
    next = next ?? { ...presets }
    next[Number(slot)] = { ...preset, label: contextName }
  }
  if (next) updateSettings({ presets: next })
}

// try to get the human readable label or fall back to a generic one
function labelFromUri(uri: string): string {
  if (uri === DJ_PLAYLIST_URI) return 'DJ'
  if (uri.startsWith('spotify:collection')) return 'Liked Songs'
  if (uri.includes(':playlist:')) return 'Playlist'
  if (uri.includes(':album:')) return 'Album'
  if (uri.includes(':artist:')) return 'Artist'
  if (uri.includes(':show:') || uri.includes(':episode:')) return 'Podcast'
  return 'Saved'
}

// maps a KeyboardEvent.code from a preset button
export function presetIndexFromCode(code: string): number | null {
  switch (code) {
    case 'Digit1':
      return 1
    case 'Digit2':
      return 2
    case 'Digit3':
      return 3
    case 'Digit4':
      return 4
    default:
      return null
  }
}
