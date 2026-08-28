import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { usePrefetch } from '../usePrefetch'
import { __resetLyricsCache } from '../useLyrics'
import { server } from '../../__tests__/msw-server'
import { activeStatus } from '../../__tests__/fixtures/observer'
import type { ObserverStatusActive, QueueTrack } from '@/api/types'

// PREFETCH_DELAY_MS is 5s
const PAST_DELAY = 6000

beforeEach(() => {
  __resetLyricsCache()
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
