import { useCallback } from 'react'
import { API_BASE } from '@/config'

async function call(method: string, path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`${path}: ${res.status}`)
  }
}

export type RepeatState = 'off' | 'context' | 'track'

export function useControls() {
  const play = useCallback(() => call('POST', '/player/resume'), [])
  const pause = useCallback(() => call('POST', '/player/pause'), [])
  const next = useCallback(() => call('POST', '/player/next', {}), [])
  const prev = useCallback(() => call('POST', '/player/prev'), [])
  const seek = useCallback(
    (positionMs: number) =>
      call('POST', '/player/seek', { position: Math.max(0, Math.round(positionMs)) }),
    [],
  )
  const togglePlayPause = useCallback(() => call('POST', '/player/playpause'), [])
  // play a playlist/album/liked on the active device
  const playContext = useCallback((uri: string) => call('POST', '/player/play', { uri }), [])
  const setVolume = useCallback(
    (volume: number, relative = false) =>
      call('POST', '/player/volume', { volume: Math.round(volume), relative }),
    [],
  )
  const setShuffle = useCallback(
    (on: boolean) => call('POST', '/player/shuffle_context', { shuffle_context: on }),
    [],
  )
  // ask the active device to switch to a new DJ set
  const djSignal = useCallback(() => call('POST', '/player/dj_signal'), [])
  const setRepeat = useCallback((mode: RepeatState) => {
    const repeat_context = mode === 'context'
    const repeat_track = mode === 'track'
    return Promise.all([
      call('POST', '/player/repeat_context', { repeat_context }),
      call('POST', '/player/repeat_track', { repeat_track }),
    ]).then(() => undefined)
  }, [])
  return {
    play,
    pause,
    next,
    prev,
    seek,
    togglePlayPause,
    playContext,
    setVolume,
    setShuffle,
    djSignal,
    setRepeat,
  }
}
