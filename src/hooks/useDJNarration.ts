import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import type { ObserverStatusActive } from '@/api/types'

const DJ_PLAYLIST_URI = 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq'

// narration length when the item does not report one, and a ceiling on any it does
const DEFAULT_NARRATION_MS = 5_000
const MAX_NARRATION_MS = 15_000

// whether this status is the narration item itself, not whether the DJ is talking
// (the DJ X fallback is a display string, so it may not hold in other locales)
export function isNarrationItem(status: ObserverStatusActive | null): boolean {
  const metadata = status?.raw_metadata
  if (!metadata) return false
  return metadata.is_narration === 'true' || metadata.album_artist_name === 'DJ X'
}

// whether a DJ set is playing
export function isDJContext(status: ObserverStatusActive | null): boolean {
  if (!status) return false
  if (status.raw_metadata?.agentic_product_type === 'dj') return true
  return status.context_uri === DJ_PLAYLIST_URI
}

export interface DJNarration {
  narrating: boolean
  title: string
  artist: string
}

const NOT_NARRATING: DJNarration = { narrating: false, title: '', artist: '' }

// a narration item seen on the wire, and how much of its speech is left
export interface SeenNarration {
  uri: string
  // shared with the song the narration introduces, so it says what the hold belongs to
  trackId: string
  ms: number
  title: string
  artist: string
}

// builds the record the observer reducer stores
export function seenNarrationFrom(status: ObserverStatusActive): SeenNarration {
  const remaining = status.duration > 0 ? status.duration - status.position : DEFAULT_NARRATION_MS
  return {
    uri: status.track_uri,
    trackId: status.track_id,
    ms: Math.min(Math.max(remaining, 0) || DEFAULT_NARRATION_MS, MAX_NARRATION_MS),
    title: status.track_name,
    artist: status.track_artist,
  }
}

// whether the DJ is talking, held for the length of the speech
export function useDJNarration(
  status: ObserverStatusActive | null,
  seen: SeenNarration | null,
): DJNarration {
  // armedUri outlives the hold, so a spent record cannot re-arm it
  const [state, setState] = useState<{ armedUri: string; active: SeenNarration | null }>({
    armedUri: '',
    active: null,
  })

  const inDJSet = isDJContext(status)

  let current = state.active
  if (inDJSet && seen != null && state.armedUri !== seen.uri) {
    current = seen
    setState({ armedUri: seen.uri, active: seen })
  } else if (
    current !== null &&
    (!inDJSet || status == null || status.track_id !== current.trackId)
  ) {
    // the speech has no subject once the track it introduced is gone, eg. a skip.
    // keep armedUri: a spent record must not re-arm
    current = null
    setState((prev) => ({ ...prev, active: null }))
  }

  // ends the hold. setState runs in the timer, not the effect body, per set-state-in-effect
  useEffect(() => {
    if (!current) return
    const t = window.setTimeout(
      () => setState((prev) => ({ ...prev, active: null })),
      current.ms + 30,
    )
    return () => window.clearTimeout(t)
  }, [current])

  // a narration item is never presentable as a track, so cover the whole time it is current,
  // including the silent pre-roll and the stretch after the hold's clock has run out
  const narrationIsCurrent = status != null && isNarrationItem(status)
  const narrating = narrationIsCurrent || current !== null
  const title = narrationIsCurrent ? status.track_name : (current?.title ?? '')
  const artist = narrationIsCurrent ? status.track_artist : (current?.artist ?? '')

  // memoised on the strings, not on status, so consumers do not re-render each position tick
  return useMemo(
    () => (narrating ? { narrating: true, title, artist } : NOT_NARRATING),
    [narrating, title, artist],
  )
}

// narration state, provided by App. Defaults to not narrating so consumers work without it
export const NarrationContext = createContext<DJNarration>(NOT_NARRATING)

// reads the narration state
export function useNarration(): DJNarration {
  return useContext(NarrationContext)
}

export interface TrackPresentation {
  title: string
  artist: string
  art: string
  djFallback: boolean
}

// what to display for the current item, substituting the DJ while it talks
export function presentTrack(
  status: ObserverStatusActive,
  narration: DJNarration,
): TrackPresentation {
  if (narration.narrating) {
    return { title: narration.title, artist: narration.artist, art: '', djFallback: true }
  }
  return {
    title: status.track_name,
    artist: status.track_artist,
    art: status.track_image,
    djFallback: false,
  }
}
