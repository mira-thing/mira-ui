import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  isDJContext,
  isNarrationItem,
  isNarrationUri,
  presentTrack,
  seenNarrationFrom,
  songNarration,
  useDJNarration,
  type SeenNarration,
} from '../useDJNarration'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatusActive } from '@/api/types'

const DJ_URI = 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq'

// shapes taken from a real 4Hz capture of the daemon during a DJ set

// an ordinary song inside the set
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

// still in the set, but not the song any narration was about
function djSkipped(): ObserverStatusActive {
  return djSong({
    track_uri: 'spotify:track:other2',
    track_id: 'other2',
    track_name: 'Something Else',
  })
}

// playback outside the DJ set entirely
function nonDJSong(): ObserverStatusActive {
  return { ...activeStatus, context_uri: 'spotify:playlist:regular', raw_metadata: null }
}

// an intro: a media item carrying the id of the song *ahead*, already speaking when it appears
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

// an outro: shapes from the Automatic -> Without Fear capture. The same kind of item as an intro,
// except it carries the id of the song *ending*, and sits queued at position 0 for ~3.9s before
// the speech starts. Its reported duration is a compressed time base, not the length of the speech
function djOutro(over: Partial<ObserverStatusActive> = {}): ObserverStatusActive {
  return djNarration({
    track_uri: 'spotify:media:outgoing1',
    track_id: 'outgoing1',
    duration: 2377,
    position: 0,
    ...over,
  })
}

// shapes from the captured metadata: a DJ line carried on the song, with no media item
function songWithLine(over: Partial<ObserverStatusActive> = {}): ObserverStatusActive {
  return djSong({
    track_uri: 'spotify:track:hold1',
    track_id: 'hold1',
    track_name: 'hold me close',
    track_artist: 'This New Light',
    position: 0,
    raw_metadata: {
      agentic_product_type: 'dj',
      'automix.talk_mode': 'human_cuepoints_or_full_track',
      // 14 words -> ~5.4s, and the jump variant is 13 -> ~5.0s
      'narration.intro.ssml':
        '<speak xml:lang="en-US">Next up, consider this a musical camping trip. <entity type="artist" uri="x">This New Light</entity> brought the marshmallows.</speak>',
      'narration.jump.ssml':
        '<speak xml:lang="en-US">OK moving on, I am bringing the campfire to us. <entity type="artist" uri="x">This New Light</entity> on first.</speak>',
      'narration.intro.title': 'Up next',
      'narration.intro.artist': 'DJ X',
    },
    ...over,
  })
}

// a song carrying only the narration keys given, for sizing the window off a known script
function songWithScript(metadata: Record<string, string>): ObserverStatusActive {
  return songWithLine({ raw_metadata: { agentic_product_type: 'dj', ...metadata } })
}

describe('isNarrationUri', () => {
  it('separates the media scheme from tracks and episodes', () => {
    expect(isNarrationUri('spotify:media:shared1')).toBe(true)
    expect(isNarrationUri('spotify:track:shared1')).toBe(false)
    expect(isNarrationUri('spotify:episode:abc')).toBe(false)
    expect(isNarrationUri(undefined)).toBe(false)
  })
})

describe('isNarrationItem', () => {
  it('is true for the narration item and false for the songs around it', () => {
    expect(isNarrationItem(djNarration())).toBe(true)
    expect(isNarrationItem(djSong())).toBe(false)
    expect(isNarrationItem(null)).toBe(false)
  })

  it('recognises a narration from the uri alone when metadata is absent', () => {
    // raw_metadata is optional on the wire, and the media scheme is not
    expect(isNarrationItem(djNarration({ raw_metadata: null }))).toBe(true)
  })

  it('still recognises a narration from is_narration when the uri is not media', () => {
    const odd = djNarration({ track_uri: 'spotify:track:shared1' })
    expect(isNarrationItem(odd)).toBe(true)
  })

  it('does not treat an artist named DJ X as a narration', () => {
    // album_artist_name is a localised display string, so it is no longer a signal
    const impostor = djSong({
      raw_metadata: { agentic_product_type: 'dj', album_artist_name: 'DJ X' },
    })
    expect(isNarrationItem(impostor)).toBe(false)
  })
})

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
    expect(isDJContext(nonDJSong())).toBe(false)
  })
})

describe('songNarration', () => {
  it('reads a line carried on the song', () => {
    const line = songNarration(songWithLine())
    expect(line).not.toBeNull()
    expect(line?.title).toBe('Up next')
    expect(line?.artist).toBe('DJ X')
  })

  it('is null for a song carrying no line', () => {
    // the Ocean Front Apt. case: a DJ-set song the DJ does not talk over
    expect(songNarration(djSong())).toBeNull()
    expect(songNarration(null)).toBeNull()
  })

  it('sizes the window from the intro script, less the lead-in', () => {
    // 14 words at the calibrated 3.55 w/s, minus the 2s already spoken over the previous track
    expect(songNarration(songWithLine())?.ms).toBeCloseTo((14 / 3.55) * 1000 - 2000, 0)
  })

  it('falls back to the jump script when there is no intro', () => {
    const jumpOnly = songNarration(
      songWithScript({
        'narration.jump.ssml': '<speak>One two three four five six seven eight nine ten.</speak>',
      }),
    )
    // 10 words is 2.8s, and the lead-in takes it under the floor
    expect(jumpOnly?.ms).toBe(1500)
  })

  it('floors a very short line', () => {
    const tiny = songNarration(songWithScript({ 'narration.intro.ssml': '<speak>Hi.</speak>' }))
    expect(tiny?.ms).toBe(1500)
  })

  it('caps a very long line', () => {
    const huge = songNarration(
      songWithScript({ 'narration.intro.ssml': `<speak>${'word '.repeat(500)}</speak>` }),
    )
    expect(huge?.ms).toBe(15000)
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

  it('ignores an outro duration too short to be speech', () => {
    // measured: outros report 1.2-2.9s while the speech runs ~4.5s, so the value is unusable
    expect(seenNarrationFrom(djOutro({ position: 8 })).ms).toBe(5000)
  })

  it('trusts a duration on the plausible side of the threshold', () => {
    // the 3s threshold is applied to the reported duration, not to what is left of it
    expect(seenNarrationFrom(djNarration({ duration: 3000, position: 200 })).ms).toBe(2800)
    expect(seenNarrationFrom(djNarration({ duration: 2999, position: 200 })).ms).toBe(5000)
  })
})

describe('useDJNarration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  interface Props {
    status: ObserverStatusActive | null
    seen: SeenNarration | null
  }

  // mirrors the hook's own signature, so a call site reads like the call it stands in for
  function setup(status: ObserverStatusActive | null, seen: SeenNarration | null) {
    const view = renderHook((props: Props) => useDJNarration(props.status, props.seen), {
      initialProps: { status, seen },
    })
    return {
      result: view.result,
      rerender: (next: ObserverStatusActive | null, nextSeen: SeenNarration | null) =>
        view.rerender({ status: next, seen: nextSeen }),
    }
  }

  // every hold in these tests is either a narration item's remaining speech (5302 - 203 = 5099ms)
  // or the 5000ms default standing in for an untrustworthy one, and the hook adds a 30ms margin.
  // This clears all of them
  const PAST_HOLD_MS = 5200

  describe('the hold left by a narration item', () => {
    it('is not narrating for a plain song with nothing seen', () => {
      const { result } = setup(djSong(), null)
      expect(result.current.narrating).toBe(false)
    })

    it('holds even though the narration item was never rendered as current status', () => {
      // the Spotify-triggered path: the hook only ever sees the next song as status
      const seen = seenNarrationFrom(djNarration())
      const { result } = setup(djSong(), seen)

      expect(result.current.narrating).toBe(true)
      expect(result.current.title).toBe('Up next')
      expect(result.current.artist).toBe('DJ X')
    })

    it('still works when the narration item is the rendered status', () => {
      const seen = seenNarrationFrom(djNarration())
      const { result } = setup(djNarration(), seen)
      expect(result.current.narrating).toBe(true)
    })

    it('stops narrating once the speech duration elapses', () => {
      const seen = seenNarrationFrom(djNarration())
      const { result, rerender } = setup(djSong(), seen)
      expect(result.current.narrating).toBe(true)

      vi.advanceTimersByTime(PAST_HOLD_MS)
      rerender(djSong(), seen)

      expect(result.current.narrating).toBe(false)
    })

    it('does not re-arm from the same narration record after it expires', () => {
      // the reducer keeps the record around, so a stale one must not restart the hold
      const seen = seenNarrationFrom(djNarration())
      const { result, rerender } = setup(djSong(), seen)

      vi.advanceTimersByTime(PAST_HOLD_MS)
      rerender(djSong(), seen)
      expect(result.current.narrating).toBe(false)

      rerender(djSong(), seen)
      expect(result.current.narrating).toBe(false)
    })

    it('re-arms on the next narration', () => {
      const first = seenNarrationFrom(djNarration())
      const { result, rerender } = setup(djSong(), first)

      vi.advanceTimersByTime(PAST_HOLD_MS)
      rerender(djSong(), first)
      expect(result.current.narrating).toBe(false)

      const second = seenNarrationFrom(
        djNarration({
          track_uri: 'spotify:media:shared2',
          track_id: 'shared2',
          duration: 4597,
          position: 253,
        }),
      )
      rerender(djSong({ track_id: 'shared2' }), second)
      expect(result.current.narrating).toBe(true)
    })

    it('keeps the same value identity across renders while narrating', () => {
      // it is provided through context, so a fresh object each render would re-render consumers
      const seen = seenNarrationFrom(djNarration())
      const { result, rerender } = setup(djSong(), seen)
      const first = result.current
      expect(first.narrating).toBe(true)

      rerender(djSong(), seen)
      expect(result.current).toBe(first)
    })

    it('drops the hold when the track is skipped during the narration', () => {
      const seen = seenNarrationFrom(djNarration())
      const { result, rerender } = setup(djNarration(), seen)
      expect(result.current.narrating).toBe(true)

      rerender(djSkipped(), seen)
      expect(result.current.narrating).toBe(false)
    })

    it('drops the hold when the song it introduced is skipped', () => {
      const seen = seenNarrationFrom(djNarration())
      const { result, rerender } = setup(djSong(), seen)
      expect(result.current.narrating).toBe(true)

      rerender(djSkipped(), seen)
      expect(result.current.narrating).toBe(false)
    })

    it('drops the hold when playback leaves the DJ set', () => {
      const seen = seenNarrationFrom(djNarration())
      const { result, rerender } = setup(djSong(), seen)
      expect(result.current.narrating).toBe(true)

      rerender(nonDJSong(), seen)
      expect(result.current.narrating).toBe(false)
    })

    it('does not replay a spent narration when the DJ set is re-entered', () => {
      // the observer keeps the last narration record, so re-entering the set must not re-arm it
      const seen = seenNarrationFrom(djNarration())
      const { result, rerender } = setup(djNarration(), seen)
      expect(result.current.narrating).toBe(true)

      rerender(nonDJSong(), seen)
      expect(result.current.narrating).toBe(false)

      rerender(djSong(), seen)
      expect(result.current.narrating).toBe(false)
    })
  })

  describe('while the narration item is current', () => {
    it('narrates for the whole time it is current, pre-roll included', () => {
      // the item is silent for ~3.9s first, but it is never presentable as a track, so the card
      // covers it rather than letting the raw item drive the screen
      const { result } = setup(djOutro(), null)
      expect(result.current.narrating).toBe(true)
      expect(result.current.artist).toBe('DJ X')
    })

    it('stays narrating as the narration position moves', () => {
      const { result, rerender } = setup(djOutro(), null)
      expect(result.current.narrating).toBe(true)

      const moving = djOutro({ position: 3 })
      rerender(moving, seenNarrationFrom(moving))
      expect(result.current.narrating).toBe(true)
      expect(result.current.artist).toBe('DJ X')
    })

    it('keeps narrating past the point the hold would have expired', () => {
      // an outro's position advances slower than wall clock and its duration is not trustworthy,
      // so the hold runs out while the DJ is still talking. The item being current covers the rest
      const moving = djOutro({ position: 3 })
      const seen = seenNarrationFrom(moving)
      const { result, rerender } = setup(moving, seen)
      expect(result.current.narrating).toBe(true)

      vi.advanceTimersByTime(PAST_HOLD_MS)
      rerender(djOutro({ position: 921 }), seen)

      expect(result.current.narrating).toBe(true)
    })

    it('keeps its value identity while a narration ticks along', () => {
      const moving = djOutro({ position: 3 })
      const seen = seenNarrationFrom(moving)
      const { result, rerender } = setup(moving, seen)
      const first = result.current

      rerender(djOutro({ position: 921 }), seen)

      expect(result.current).toBe(first)
    })

    it('stops narrating when the outro gives way to a plain song', () => {
      const moving = djOutro({ position: 3 })
      const seen = seenNarrationFrom(moving)
      const { result, rerender } = setup(moving, seen)
      expect(result.current.narrating).toBe(true)

      vi.advanceTimersByTime(PAST_HOLD_MS)
      rerender(djSong(), seen)

      expect(result.current.narrating).toBe(false)
    })
  })

  describe('a line carried on the song', () => {
    it('narrates for a song whose line arrives with no media item', () => {
      // the invisible class: "hold me close" etc. carried the line inline and never emitted an item
      const { result } = setup(songWithLine(), null)
      expect(result.current.narrating).toBe(true)
      expect(result.current.title).toBe('Up next')
      expect(result.current.artist).toBe('DJ X')
    })

    it('stops narrating once the song plays past the estimated line', () => {
      const { result, rerender } = setup(songWithLine(), null)
      expect(result.current.narrating).toBe(true)

      // the window is ~3.9s of the song's own clock, so this is past it
      rerender(songWithLine({ position: 6000 }), null)
      expect(result.current.narrating).toBe(false)
    })

    it('never narrates for a DJ song carrying no line, at any position', () => {
      const { result, rerender } = setup(djSong({ position: 0 }), null)
      expect(result.current.narrating).toBe(false)

      rerender(djSong({ position: 1000 }), null)
      expect(result.current.narrating).toBe(false)
    })

    it('does not narrate while paused inside the line', () => {
      // pausing stops the audio, so the DJ is not talking
      const { result, rerender } = setup(songWithLine({ position: 1200 }), null)
      expect(result.current.narrating).toBe(true)

      rerender(songWithLine({ position: 1200, is_paused: true }), null)
      expect(result.current.narrating).toBe(false)
    })

    it('does not open a song window after the covering item has finished', () => {
      // the Stable Song regression: once the item's hold expires the card must go, not restart
      // on the song's own line, which left it up ~32s
      const seen = seenNarrationFrom(djNarration({ track_id: 'hold1' }))
      const { result, rerender } = setup(songWithLine({ position: 500 }), seen)
      expect(result.current.narrating).toBe(true)

      // past the item's hold, but still inside the song's estimated line
      vi.advanceTimersByTime(PAST_HOLD_MS)
      rerender(songWithLine({ position: 1000 }), seen)
      expect(result.current.narrating).toBe(false)
    })

    it('still opens a song window when the last item belonged to a different song', () => {
      // the Up in Flames case: the previous item introduced the track before this one
      const seen = seenNarrationFrom(djNarration({ track_id: 'someoneelse' }))
      const { result } = setup(songWithLine(), seen)
      expect(result.current.narrating).toBe(true)
      expect(result.current.title).toBe('Up next')
    })
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
    expect(presentTrack(djNarration(), TALKING)).toEqual({
      title: 'Up next',
      artist: 'DJ X',
      art: '',
      djFallback: true,
    })
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
