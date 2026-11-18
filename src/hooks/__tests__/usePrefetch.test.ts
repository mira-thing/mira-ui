import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { playerCoverUrl, usePrefetch } from '../usePrefetch'
import { __resetLyricsCache } from '../useLyrics'
import { loadArtwork, prepareArtwork } from '../useColorExtract'
import { server } from '../../__tests__/msw-server'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatusActive, QueueTrack } from '@/api/types'

// PREFETCH_DELAY_MS is 5s
const PAST_DELAY = 6000

vi.mock('../useColorExtract', () => ({
  prepareArtwork: vi.fn().mockResolvedValue(undefined),
  loadArtwork: vi.fn().mockResolvedValue(null),
}))

beforeEach(() => {
  __resetLyricsCache()
  vi.mocked(prepareArtwork).mockClear()
  vi.mocked(loadArtwork).mockClear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function track(over: Partial<QueueTrack> = {}): QueueTrack {
  return {
    uri: 'spotify:track:song1',
    track_id: 'song1',
    name: 'EFM1.0',
    artist: 'Killen.',
    album: 'EFM',
    image_url: '',
    ...over,
  }
}

describe('usePrefetch lyrics', () => {
  it('skips DJ narration entries but still prefetches the paired song', async () => {
    // the narration shares the song's track id, so only the scheme distinguishes them
    const asked: string[] = []
    server.use(
      http.get('*/lyrics/:id', ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('artist') ?? '')
        return new HttpResponse(null, { status: 404 })
      }),
    )

    const status: ObserverStatusActive = {
      ...activeStatus,
      track_uri: 'spotify:track:current-a',
      next_tracks: [
        track({ uri: 'spotify:track:shared-a', track_id: 'shared-a' }),
        track({
          uri: 'spotify:media:shared-a',
          track_id: 'shared-a',
          name: 'Up next',
          artist: 'DJ X',
        }),
      ],
      prev_tracks: [],
    }

    renderHook(() => usePrefetch(status))
    await vi.advanceTimersByTimeAsync(PAST_DELAY)
    // let the in-flight fetches settle
    await vi.advanceTimersByTimeAsync(100)

    expect(asked).toContain('Killen.')
    expect(asked).not.toContain('DJ X')
  })

  it('still prefetches ordinary tracks', async () => {
    const asked: string[] = []
    server.use(
      http.get('*/lyrics/:id', ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('artist') ?? '')
        return new HttpResponse(null, { status: 404 })
      }),
    )

    const status: ObserverStatusActive = {
      ...activeStatus,
      track_uri: 'spotify:track:current-b',
      next_tracks: [
        track({ uri: 'spotify:track:plain-b', track_id: 'plain-b', artist: 'Hazlett' }),
      ],
      prev_tracks: [],
    }

    renderHook(() => usePrefetch(status))
    await vi.advanceTimersByTimeAsync(PAST_DELAY)
    await vi.advanceTimersByTimeAsync(100)

    expect(asked).toContain('Hazlett')
  })
})

describe('usePrefetch art', () => {
  const thumb = 'https://i.scdn.co/image/ab67616d00004851eabb357935ae4fb4c5ed7668'
  const cover = 'https://i.scdn.co/image/ab67616d00001e02eabb357935ae4fb4c5ed7668'

  it('loads the next cover at the size the player shows, not the queue thumbnail', () => {
    const status: ObserverStatusActive = {
      ...activeStatus,
      next_tracks: [track({ image_url: thumb })],
      prev_tracks: [],
    }
    renderHook(() => usePrefetch(status))
    expect(loadArtwork).toHaveBeenCalledWith(cover)
    expect(loadArtwork).not.toHaveBeenCalledWith(thumb)
  })

  it('warms each queued cover at the size the player asks for', async () => {
    const made: { src: string }[] = []
    const image = vi.spyOn(window, 'Image').mockImplementation(function () {
      const img = { src: '' }
      made.push(img)
      return img as unknown as HTMLImageElement
    })
    const status: ObserverStatusActive = {
      ...activeStatus,
      next_tracks: [track({ uri: 'spotify:track:warm', track_id: 'warm', image_url: thumb })],
      prev_tracks: [],
    }
    renderHook(() => usePrefetch(status))
    await vi.advanceTimersByTimeAsync(PAST_DELAY)
    image.mockRestore()
    expect(made.map((i) => i.src)).toEqual([cover])
  })

  it('leaves art that is not a Spotify album cover as it is', () => {
    expect(playerCoverUrl(cover)).toBe(cover)
    expect(playerCoverUrl('https://i.scdn.co/image/ab6765630000ba8a1234')).toBe(
      'https://i.scdn.co/image/ab6765630000ba8a1234',
    )
    expect(playerCoverUrl('https://example.com/ab67616d00004851x')).toBe(
      'https://example.com/ab67616d00004851x',
    )
  })
})
