import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  isDJContext,
  isNarrationItem,
  presentTrack,
  seenNarrationFrom,
  useDJNarration,
  type SeenNarration,
} from '../useDJNarration'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatusActive } from '@/api/types'

const DJ_URI = 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq'

// shapes taken from a real 4Hz capture of the daemon during a DJ set
function djSong(over: Partial<ObserverStatusActive> = {}): ObserverStatusActive {
  return {
    ...activeStatus,
    context_uri: DJ_URI,
    track_uri: 'spotify:track:shared1',
    track_id: 'shared1',
    track_name: 'Joshua Tree',
    track_artist: 'Cautious Clay',
    track_image: 'https://x/song.jpg',
    duration: 197551,
    position: 357,
    raw_metadata: { agentic_product_type: 'dj', title: 'Joshua Tree' },
    ...over,
  }
}

function djNarration(over: Partial<ObserverStatusActive> = {}): ObserverStatusActive {
  return {
    ...activeStatus,
    context_uri: DJ_URI,
    // shares the id of the song it introduces, differing only in scheme
    track_uri: 'spotify:media:shared1',
    track_id: 'shared1',
    track_name: 'Up next',
    track_artist: 'DJ X',
    track_image: 'https://lexicon-assets.spotifycdn.com/Your-DJ-Cover-Art-300.png',
    duration: 5302,
    position: 203,
    raw_metadata: {
      agentic_product_type: 'dj',
      is_narration: 'true',
      album_artist_name: 'DJ X',
      title: 'Up next',
    },
    ...over,
  }
}

// an outro: shapes from the Automatic -> Without Fear capture. It carries the id of the song
// *ending*, and sits queued at position 0 for ~3.9s before the speech starts
function djOutro(over: Partial<ObserverStatusActive> = {}): ObserverStatusActive {
  return {
    ...activeStatus,
    context_uri: DJ_URI,
    track_uri: 'spotify:media:outgoing1',
    track_id: 'outgoing1',
    track_name: 'Up next',
    track_artist: 'DJ X',
    duration: 2377,
    position: 0,
    raw_metadata: {
      agentic_product_type: 'dj',
      is_narration: 'true',
      album_artist_name: 'DJ X',
      title: 'Up next',
    },
    ...over,
  }
}

function djSkipped(): ObserverStatusActive {
  return djSong({
    track_uri: 'spotify:track:other2',
    track_id: 'other2',
    track_name: 'Something Else',
  })
}

describe('isDJContext', () => {
  it('is false with no status', () => {
    expect(isDJContext(null)).toBe(false)
  })

  it('identifies a DJ set from agentic_product_type on a song', () => {
    // every item in a DJ set carries this, songs included, so no latching is needed
    expect(isDJContext(djSong())).toBe(true)
  })

  it('identifies a DJ set on the narration item too', () => {
    expect(isDJContext(djNarration())).toBe(true)
  })

  it('still falls back to the DJ playlist uri', () => {
    expect(isDJContext({ ...activeStatus, context_uri: DJ_URI, raw_metadata: null })).toBe(true)
  })

  it('is false for a normal playlist', () => {
    const normal = { ...activeStatus, context_uri: 'spotify:playlist:regular', raw_metadata: null }
    expect(isDJContext(normal)).toBe(false)
  })
})

describe('seenNarrationFrom', () => {
  it('takes the remaining speech time from the narration item', () => {
    // duration 5302 - position 203
    expect(seenNarrationFrom(djNarration())).toEqual({
      uri: 'spotify:media:shared1',
      trackId: 'shared1',
      ms: 5099,
      title: 'Up next',
      artist: 'DJ X',
    })
  })

  it('falls back to a default when duration is missing', () => {
    expect(seenNarrationFrom(djNarration({ duration: 0, position: 0 })).ms).toBe(5000)
  })

  it('caps an absurd duration', () => {
    expect(seenNarrationFrom(djNarration({ duration: 60 * 60 * 1000, position: 0 })).ms).toBe(15000)
  })
})

describe('useDJNarration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  type Args = [ObserverStatusActive | null, SeenNarration | null]

  function setup(initialProps: Args) {
    return renderHook(([s, seen]: Args) => useDJNarration(s, seen), { initialProps })
  }

  it('is not narrating for a plain song with nothing seen', () => {
    const { result } = setup([djSong(), null])
    expect(result.current.narrating).toBe(false)
  })

  it('holds even though the narration item was never rendered as current status', () => {
    // the Spotify-triggered path: the hook only ever sees the next song as status
    const seen = seenNarrationFrom(djNarration())
    const { result } = setup([djSong(), seen])

    expect(result.current.narrating).toBe(true)
    expect(result.current.title).toBe('Up next')
    expect(result.current.artist).toBe('DJ X')
  })

  it('still works when the narration item is the rendered status', () => {
    const seen = seenNarrationFrom(djNarration())
    const { result } = setup([djNarration(), seen])
    expect(result.current.narrating).toBe(true)
  })

  it('stops narrating once the speech duration elapses', () => {
    const seen = seenNarrationFrom(djNarration())
    const { result, rerender } = setup([djSong(), seen])
    expect(result.current.narrating).toBe(true)

    vi.advanceTimersByTime(5200)
    rerender([djSong(), seen])

    expect(result.current.narrating).toBe(false)
  })

  it('does not re-arm from the same narration record after it expires', () => {
    // the reducer keeps the record around, so a stale one must not restart the hold
    const seen = seenNarrationFrom(djNarration())
    const { result, rerender } = setup([djSong(), seen])

    vi.advanceTimersByTime(5200)
    rerender([djSong(), seen])
    expect(result.current.narrating).toBe(false)

    rerender([djSong(), seen])
    expect(result.current.narrating).toBe(false)
  })

  it('re-arms on the next narration', () => {
    const first = seenNarrationFrom(djNarration())
    const { result, rerender } = setup([djSong(), first])

    vi.advanceTimersByTime(5400)
    rerender([djSong(), first])
    expect(result.current.narrating).toBe(false)

    const second = seenNarrationFrom(
      djNarration({
        track_uri: 'spotify:media:shared2',
        track_id: 'shared2',
        duration: 4597,
        position: 253,
      }),
    )
    rerender([djSong({ track_id: 'shared2' }), second])
    expect(result.current.narrating).toBe(true)
  })

  it('keeps the same value identity across renders while narrating', () => {
    // it is provided through context, so a fresh object each render would re-render consumers
    const seen = seenNarrationFrom(djNarration())
    const { result, rerender } = setup([djSong(), seen])
    const first = result.current
    expect(first.narrating).toBe(true)

    rerender([djSong(), seen])
    expect(result.current).toBe(first)
  })

  it('drops the hold when the track is skipped during the narration', () => {
    const seen = seenNarrationFrom(djNarration())
    const { result, rerender } = setup([djNarration(), seen])
    expect(result.current.narrating).toBe(true)

    rerender([djSkipped(), seen])
    expect(result.current.narrating).toBe(false)
  })

  it('drops the hold when the song it introduced is skipped', () => {
    const seen = seenNarrationFrom(djNarration())
    const { result, rerender } = setup([djSong(), seen])
    expect(result.current.narrating).toBe(true)

    rerender([djSkipped(), seen])
    expect(result.current.narrating).toBe(false)
  })

  it('does not replay a spent narration when the DJ set is re-entered', () => {
    // the observer keeps the last narration record, so re-entering the set must not re-arm it
    const seen = seenNarrationFrom(djNarration())
    const { result, rerender } = setup([djNarration(), seen])
    expect(result.current.narrating).toBe(true)

    const normal = { ...activeStatus, context_uri: 'spotify:playlist:regular', raw_metadata: null }
    rerender([normal, seen])
    expect(result.current.narrating).toBe(false)

    rerender([djSong(), seen])
    expect(result.current.narrating).toBe(false)
  })

  it('narrates for the whole time the narration item is current, pre-roll included', () => {
    // the item is silent for ~3.9s first, but it is never presentable as a track, so the card
    // covers it rather than letting the raw item drive the screen
    const { result } = setup([djOutro(), null])
    expect(result.current.narrating).toBe(true)
    expect(result.current.artist).toBe('DJ X')
  })

  it('stays narrating as the narration position moves', () => {
    const { result, rerender } = setup([djOutro(), null])
    expect(result.current.narrating).toBe(true)

    const moving = djOutro({ position: 3 })
    rerender([moving, seenNarrationFrom(moving)])
    expect(result.current.narrating).toBe(true)
    expect(result.current.artist).toBe('DJ X')
  })

  it('keeps narrating past the point the hold would have expired', () => {
    // an outro's position advances slower than wall clock, so duration - position runs out
    // while the DJ is still talking. The item being current is what covers the rest
    const moving = djOutro({ position: 3 })
    const seen = seenNarrationFrom(moving)
    const { result, rerender } = setup([moving, seen])
    expect(result.current.narrating).toBe(true)

    vi.advanceTimersByTime(2600) // past duration 2377
    rerender([djOutro({ position: 921 }), seen])

    expect(result.current.narrating).toBe(true)
  })

  it('keeps its value identity while a narration ticks along', () => {
    const moving = djOutro({ position: 3 })
    const seen = seenNarrationFrom(moving)
    const { result, rerender } = setup([moving, seen])
    const first = result.current

    rerender([djOutro({ position: 921 }), seen])

    expect(result.current).toBe(first)
  })

  it('stops narrating when the outro gives way to a plain song', () => {
    const moving = djOutro({ position: 3 })
    const seen = seenNarrationFrom(moving)
    const { result, rerender } = setup([moving, seen])
    expect(result.current.narrating).toBe(true)

    vi.advanceTimersByTime(2600)
    rerender([djSong(), seen])

    expect(result.current.narrating).toBe(false)
  })

  it('drops the hold when playback leaves the DJ set', () => {
    const seen = seenNarrationFrom(djNarration())
    const { result, rerender } = setup([djSong(), seen])
    expect(result.current.narrating).toBe(true)

    const normal = { ...activeStatus, context_uri: 'spotify:playlist:regular', raw_metadata: null }
    rerender([normal, seen])
    expect(result.current.narrating).toBe(false)
  })
})

describe('presentTrack', () => {
  const NOT_TALKING = { narrating: false, title: '', artist: '' }
  const TALKING = { narrating: true, title: 'Up next', artist: 'DJ X' }

  it('shows the real track when the DJ is not talking', () => {
    expect(presentTrack(djSong(), NOT_TALKING)).toEqual({
      title: 'Joshua Tree',
      artist: 'Cautious Clay',
      art: 'https://x/song.jpg',
      djFallback: false,
    })
  })

  it('never presents a narration item using its own artwork', () => {
    // the narration carries Spotify's DJ cover url; presenting it raw showed an unstyled screen
    const shown = presentTrack(djNarration(), TALKING)
    expect(shown.art).toBe('')
    expect(shown.djFallback).toBe(true)
    expect(shown.art).not.toContain('lexicon-assets')
  })

  it('substitutes the DJ and drops the artwork while talking', () => {
    // status describes the song queued behind the speech, so none of it may leak through
    expect(presentTrack(djSong(), TALKING)).toEqual({
      title: 'Up next',
      artist: 'DJ X',
      art: '',
      djFallback: true,
    })
  })
})

describe('isNarrationItem', () => {
  it('is true for the narration item and false for the songs around it', () => {
    expect(isNarrationItem(djNarration())).toBe(true)
    expect(isNarrationItem(djSong())).toBe(false)
    expect(isNarrationItem(null)).toBe(false)
  })
})
