import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import type { ObserverStatusActive } from '@/api/types'

export const DJ_PLAYLIST_URI = 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq'

// narration length when the item does not report a usable one, and a ceiling on any it does
const DEFAULT_NARRATION_MS = 5_000
const MAX_NARRATION_MS = 15_000
// speech is never really this short. Below it the reported duration is a compressed time base,
// so it is treated as missing rather than trusted
const MIN_PLAUSIBLE_NARRATION_MS = 3_000
// measured against narration items reporting a duration for the same script: median 3.55,
// spread 1.96-4.51. Raise it to end the card sooner, lower it to hold longer
const WORDS_PER_SECOND = 3.55
// floor only guards against a flash on a very short line
const MIN_SONG_LINE_MS = 1_500
// the line starts over the previous track, so part of it is already spoken by the time this
// song's clock starts. Measured at ~3400 (audio.fade_overlap); the full value ends the card on
// time but hides short lines completely, so this trims the overrun without losing them
const NARRATION_LEAD_IN_MS = 2_000
// slack so the hold outlasts the speech rather than clipping its last moment
const HOLD_MARGIN_MS = 30

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// queue entries carry no metadata, so the uri scheme is all they have
export function isNarrationUri(uri: string | undefined): boolean {
  return uri?.startsWith('spotify:media:') ?? false
}

// whether this status is the narration item itself, not whether the DJ is talking
export function isNarrationItem(status: ObserverStatusActive | null): boolean {
  if (!status) return false
  return isNarrationUri(status.track_uri) || status.raw_metadata?.is_narration === 'true'
}

export function isDJContext(status: ObserverStatusActive | null): boolean {
  if (!status) return false
  if (status.raw_metadata?.agentic_product_type === 'dj') return true
  return status.context_uri === DJ_PLAYLIST_URI
}

// a DJ line carried on the song itself rather than as a media item
export interface SongNarration {
  title: string
  artist: string
  ms: number
}

function speechMsFromSsml(ssml: string): number {
  const words = ssml
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/).length
  return (words / WORDS_PER_SECOND) * 1000
}

export function songNarration(status: ObserverStatusActive | null): SongNarration | null {
  const metadata = status?.raw_metadata
  if (!metadata) return null
  // the intro is the line that plays unless the listener jumped in, and it is what the
  // calibration was measured against
  const field = (name: string) =>
    metadata[`narration.intro.${name}`] || metadata[`narration.jump.${name}`]

  const script = field('ssml')
  if (!script) return null
  return {
    title: field('title') || 'Up next',
    artist: field('artist') || 'DJ X',
    ms: clamp(speechMsFromSsml(script) - NARRATION_LEAD_IN_MS, MIN_SONG_LINE_MS, MAX_NARRATION_MS),
  }
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

function remainingSpeechMs(status: ObserverStatusActive): number {
  if (status.duration < MIN_PLAUSIBLE_NARRATION_MS) return DEFAULT_NARRATION_MS
  const remaining = status.duration - status.position
  if (remaining <= 0) return DEFAULT_NARRATION_MS
  return Math.min(remaining, MAX_NARRATION_MS)
}

export function seenNarrationFrom(status: ObserverStatusActive): SeenNarration {
  return {
    uri: status.track_uri,
    trackId: status.track_id,
    ms: remainingSpeechMs(status),
    title: status.track_name,
    artist: status.track_artist,
  }
}

interface Speaker {
  title: string
  artist: string
}

// who the card credits the speech to, first match winning
function speakerFor(
  status: ObserverStatusActive | null,
  seen: SeenNarration | null,
  held: SeenNarration | null,
): Speaker | null {
  if (status == null) return held
  // a narration item is never presentable as a track, so it owns the card for the whole time it
  // is current: silent pre-roll included, and past the point the hold's clock has run out
  if (isNarrationItem(status)) return { title: status.track_name, artist: status.track_artist }

  // the line the song carries is clocked on position, so it freezes when paused and resets on a
  // skip. An item introducing this song shares its id, and its own hold already covers the speech
  const line = songNarration(status)
  const coveredByItem = seen?.trackId === status.track_id
  if (line != null && !coveredByItem && !status.is_paused && status.position < line.ms) return line

  return held
}

interface Hold {
  // outlives the narration itself, so a spent record cannot re-arm the hold
  armedUri: string
  narration: SeenNarration | null
}

// whether the DJ is talking, held for the length of the speech
export function useDJNarration(
  status: ObserverStatusActive | null,
  seen: SeenNarration | null,
): DJNarration {
  const [hold, setHold] = useState<Hold>({ armedUri: '', narration: null })

  const inDJSet = isDJContext(status)

  let held = hold.narration
  if (inDJSet && seen != null && seen.uri !== hold.armedUri) {
    held = seen
    setHold({ armedUri: seen.uri, narration: seen })
  } else if (held != null && (!inDJSet || status?.track_id !== held.trackId)) {
    // the speech has no subject once the track it introduced is gone, eg. a skip
    held = null
    setHold((prev) => ({ ...prev, narration: null }))
  }

  // setHold runs in the timer, not the effect body, per set-state-in-effect
  useEffect(() => {
    if (!held) return
    const timer = window.setTimeout(
      () => setHold((prev) => ({ ...prev, narration: null })),
      held.ms + HOLD_MARGIN_MS,
    )
    return () => window.clearTimeout(timer)
  }, [held])

  const speaker = speakerFor(status, seen, held)
  const narrating = speaker !== null
  const title = speaker?.title ?? ''
  const artist = speaker?.artist ?? ''

  // memoised on the strings, not on the speaker, so consumers do not re-render each position tick
  return useMemo(
    () => (narrating ? { narrating: true, title, artist } : NOT_NARRATING),
    [narrating, title, artist],
  )
}

// provided by App. Defaults to not narrating so consumers work without it
export const NarrationContext = createContext<DJNarration>(NOT_NARRATING)

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
