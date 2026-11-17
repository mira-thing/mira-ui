import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLyrics } from '@/api/client'
import type { LyricsResult } from '@/api/types'

interface LyricsParams {
  trackId: string | null
  trackName: string
  artist: string
  album?: string
  durationMs?: number
  episode?: boolean
  enabled?: boolean
  karaoke?: boolean
}

interface LyricsState {
  lyrics: LyricsResult | null
  loading: boolean
  error: string | null
}

const CACHE_LIMIT = 50

// LRU keyed by track id, map insertion order = recency, evict from the front
const cache = new Map<string, LyricsResult>()

const RICHSYNC_TRIED_LIMIT = 500
const richsyncTried = new Set<string>()

function richsyncMarkTried(id: string): void {
  if (!richsyncTried.has(id) && richsyncTried.size >= RICHSYNC_TRIED_LIMIT) {
    const oldest = richsyncTried.values().next().value
    if (oldest !== undefined) richsyncTried.delete(oldest)
  }
  richsyncTried.add(id)
}

// test-only escape hatch
export function __resetLyricsCache(): void {
  cache.clear()
  richsyncTried.clear()
}

function cacheGet(id: string): LyricsResult | undefined {
  const v = cache.get(id)
  if (v !== undefined) {
    cache.delete(id)
    cache.set(id, v) // bump recency
  }
  return v
}

function cacheSet(id: string, lyrics: LyricsResult): void {
  if (cache.has(id)) cache.delete(id)
  cache.set(id, lyrics)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function primeLyricsCache(id: string, lyrics: LyricsResult): void {
  if (!cache.has(id)) cacheSet(id, lyrics)
}

const FETCH_DEBOUNCE_MS = 150

function hasWordTiming(lyrics: LyricsResult): boolean {
  return lyrics.lines.some((l) => (l.syllables?.length ?? 0) > 0)
}

export function useLyrics(params: LyricsParams): LyricsState {
  // tagged with its track, so a new track never renders the last one's lyrics before the effect
  const [state, setTagged] = useState<LyricsState & { trackId?: string | null }>({
    lyrics: null,
    loading: false,
    error: null,
  })

  const {
    trackId,
    trackName,
    artist,
    album,
    durationMs,
    episode,
    enabled = true,
    karaoke = true,
  } = params
  const debounceRef = useRef(0)
  const setState = useCallback(
    (next: LyricsState | ((s: LyricsState) => LyricsState)) =>
      setTagged((s) => {
        const own = s.trackId === trackId ? s : { lyrics: null, loading: false, error: null }
        return { ...(typeof next === 'function' ? next(own) : next), trackId }
      }),
    [trackId],
  )

  useEffect(() => {
    // lyric view hidden dont fetch
    if (!enabled) return

    if (!trackId) {
      setState({ lyrics: null, loading: false, error: null })
      return
    }

    const ac = new AbortController()

    const upgradeToWordByWord = () => {
      if (episode || !karaoke || richsyncTried.has(trackId)) return
      fetchLyrics(
        trackId,
        { track: trackName, artist, album, durationMs, richsync: true },
        ac.signal,
      )
        .then((rich) => {
          if (ac.signal.aborted || !rich) return
          if (hasWordTiming(rich)) {
            cacheSet(trackId, rich)
            setState({ lyrics: rich, loading: false, error: null })
          } else {
            richsyncMarkTried(trackId)
          }
        })
        .catch(() => {
          // word by word is a bonus
        })
    }

    // the cache is keyed by id, so a prefetched track shows before its title and artist resolve
    if (!episode) {
      const cached = cacheGet(trackId)
      if (cached) {
        setState({ lyrics: cached, loading: false, error: null })
        if (!hasWordTiming(cached) && trackName && artist) upgradeToWordByWord()
        return () => ac.abort()
      }
    }

    // tracks need name + artist to look up and episodes are fetched by id alone
    if (!episode && (!trackName || !artist)) {
      setState({ lyrics: null, loading: false, error: null })
      return () => ac.abort()
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      fetchLyrics(trackId, { track: trackName, artist, album, durationMs, episode }, ac.signal)
        .then((lyrics) => {
          if (ac.signal.aborted) return
          if (lyrics && !episode) cacheSet(trackId, lyrics)
          setState({ lyrics, loading: false, error: null })
          if (lyrics && !episode && !hasWordTiming(lyrics)) upgradeToWordByWord()
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setState({ lyrics: null, loading: false, error: (err as Error).message })
        })
    }, FETCH_DEBOUNCE_MS)

    return () => {
      ac.abort()
      window.clearTimeout(debounceRef.current)
    }
  }, [trackId, trackName, artist, album, durationMs, episode, enabled, karaoke, setState])

  const own = state.trackId === trackId
  const cached = !own && trackId && !episode ? cache.get(trackId) : undefined
  const lyrics = own ? state.lyrics : (cached ?? null)
  const loading = own ? state.loading : !cached && enabled && !!trackId
  const error = own ? state.error : null
  return useMemo(() => ({ lyrics, loading, error }), [lyrics, loading, error])
}

// offsetMs is the user-tunable lyric timing knob which is currently stripped
export function getActiveLyricIndex(
  starts: number[],
  positionMs: number,
  offsetMs: number,
): number {
  if (starts.length === 0) return -1
  const target = positionMs + offsetMs

  let lo = 0
  let hi = starts.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= target) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}

export function useLyricStarts(lyrics: LyricsResult | null): number[] {
  return useMemo(() => {
    if (!lyrics) return []
    return lyrics.lines.map((l) => parseInt(l.startTimeMs, 10) || 0)
  }, [lyrics])
}
