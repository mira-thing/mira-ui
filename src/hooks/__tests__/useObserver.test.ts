import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ApiEvent, ObserverStatusActive } from '../../api/types'
import { server } from '../../__tests__/msw-server'
import { activeStatus, baseWire } from '../../__tests__/fixtures/observer'

const busState = vi.hoisted(() => ({
  listeners: [] as Array<(evt: { type: string; data: unknown }) => void>,
  connListeners: [] as Array<(c: boolean) => void>,
  connected: false,
}))

vi.mock('@/api/eventBus', () => ({
  subscribeEvents: (fn: (evt: { type: string; data: unknown }) => void) => {
    busState.listeners.push(fn)
    return () => {
      const i = busState.listeners.indexOf(fn)
      if (i >= 0) busState.listeners.splice(i, 1)
    }
  },
  subscribeConnection: (fn: (c: boolean) => void) => {
    busState.connListeners.push(fn)
    fn(busState.connected)
    return () => {
      const i = busState.connListeners.indexOf(fn)
      if (i >= 0) busState.connListeners.splice(i, 1)
    }
  },
}))

import { useObserver } from '../useObserver'

function fireEvent(evt: ApiEvent) {
  for (const l of busState.listeners) l(evt)
}

function fireConnection(c: boolean) {
  busState.connected = c
  for (const l of busState.connListeners) l(c)
}

beforeEach(() => {
  busState.listeners.length = 0
  busState.connListeners.length = 0
  busState.connected = false
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useObserver', () => {
  it('exposes the initial state synchronously on first render', () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())

    expect(result.current.status).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.connected).toBe(false)
  })

  it('populates status and clears loading on a successful first poll', async () => {
    server.use(http.get('*/observer/status', () => HttpResponse.json(activeStatus)))

    const { result } = renderHook(() => useObserver())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.status).toMatchObject({
      active: true,
      track_name: 'Test Song',
    })
    expect(result.current.error).toBeNull()
  })

  it('does not reset status when a subsequent poll errors', async () => {
    // bar would blank every time the daemon hiccupped if we cleared on error
    server.use(
      http.get('*/observer/status', async () => {
        await new Promise((r) => setTimeout(r, 50))
        return new HttpResponse(null, { status: 500 })
      }),
    )

    const { result } = renderHook(() => useObserver())

    await act(async () => {
      fireEvent({ type: 'observer_track_changed', data: baseWire })
    })
    expect(result.current.status).toMatchObject({ active: true })

    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.status).toMatchObject({ active: true })
    expect(result.current.loading).toBe(false)
  })

  it('replaces full status on observer_state_changed via remoteStateToStatus', async () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())

    await act(async () => {
      fireEvent({
        type: 'observer_state_changed',
        data: { ...baseWire, TrackName: 'Renamed' },
      })
    })

    expect(result.current.status).toMatchObject({
      active: true,
      track_name: 'Renamed',
    })
    expect(result.current.loading).toBe(false)
  })

  it('replaces full status on observer_track_changed via remoteStateToStatus', async () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())

    await act(async () => {
      fireEvent({
        type: 'observer_track_changed',
        data: { ...baseWire, TrackName: 'Next Track' },
      })
    })

    expect(result.current.status).toMatchObject({
      active: true,
      track_name: 'Next Track',
    })
  })

  it('ignores legacy patch-style events and waits for full snapshots', async () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())

    await act(async () => {
      fireEvent({
        type: 'observer_state_changed',
        data: { ...baseWire, IsPlaying: true, IsPaused: false },
      })
    })

    await act(async () => {
      fireEvent({ type: 'paused', data: null })
    })

    expect(result.current.status).toMatchObject({
      active: true,
      is_paused: false,
      is_playing: true,
    })
  })

  it('ignores seek patches, even with numeric positions', async () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())

    await act(async () => {
      fireEvent({
        type: 'observer_state_changed',
        data: { ...baseWire, PositionAsOfTimestamp: 30_000 },
      })
    })

    await act(async () => {
      fireEvent({ type: 'seek', data: { position: 45_000 } })
    })

    expect((result.current.status as ObserverStatusActive).position).toBe(30_000)
  })

  it('ignores patch-style events when there is no baseline status', async () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())

    await act(async () => {
      fireEvent({ type: 'paused', data: null })
    })

    expect(result.current.status).toBeNull()
  })

  it('reflects connection bus transitions on the `connected` field', async () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())

    expect(result.current.connected).toBe(false)

    await act(async () => {
      fireConnection(true)
    })
    expect(result.current.connected).toBe(true)

    await act(async () => {
      fireConnection(false)
    })
    expect(result.current.connected).toBe(false)
  })

  it('drops a stale poll response that lands after a WS snapshot arrived mid-flight', async () => {
    server.use(
      http.get('*/observer/status', async () => {
        await new Promise((r) => setTimeout(r, 60))
        return HttpResponse.json(activeStatus)
      }),
    )

    const { result } = renderHook(() => useObserver())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
      fireEvent({
        type: 'observer_state_changed',
        data: { ...baseWire, TrackName: 'Fresh from WS' },
      })
    })
    expect(result.current.status).toMatchObject({ track_name: 'Fresh from WS' })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    expect(result.current.status).toMatchObject({ track_name: 'Fresh from WS' })
  })

  it('tracks setup_progress events monotonically', async () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())
    expect(result.current.setupProgress).toBeNull()

    await act(async () => {
      fireEvent({
        type: 'setup_progress',
        data: { stage: 'liked', done: 100, total: 400, percent: 6.25 },
      })
    })
    expect(result.current.setupProgress).toMatchObject({ stage: 'liked', percent: 6.25 })

    await act(async () => {
      fireEvent({
        type: 'setup_progress',
        data: { stage: 'playlists', done: 10, total: 20, percent: 27.5 },
      })
    })
    expect(result.current.setupProgress).toMatchObject({ stage: 'playlists', percent: 27.5 })

    // a lower percent must never move the bar backwards
    await act(async () => {
      fireEvent({
        type: 'setup_progress',
        data: { stage: 'playlists', done: 5, total: 20, percent: 26 },
      })
    })
    expect(result.current.setupProgress).toMatchObject({ percent: 27.5 })
  })

  it('picks up setting_up_progress from the polled status', async () => {
    server.use(
      http.get('*/observer/status', () =>
        HttpResponse.json({
          active: false,
          message: 'setting things up',
          setting_up: true,
          setting_up_progress: { stage: 'liked', done: 50, total: 400, percent: 3.1 },
        }),
      ),
    )

    const { result } = renderHook(() => useObserver())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.setupProgress).toMatchObject({ stage: 'liked', percent: 3.1 })
  })

  it('polls again after POLL_MS even if WS events keep state fresh', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    })

    let requests = 0
    server.use(
      http.get('*/observer/status', () => {
        requests++
        return HttpResponse.json(activeStatus)
      }),
    )

    renderHook(() => useObserver())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(requests).toBe(1)

    await vi.advanceTimersByTimeAsync(2_999)
    expect(requests).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(requests).toBe(2)
  })

  it('captures a DJ narration even when the next song supersedes it in the same batch', async () => {
    // batched together, only the song renders, so the reducer has to capture the narration
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))

    const { result } = renderHook(() => useObserver())

    const narration = {
      ...baseWire,
      TrackUri: 'spotify:media:shared1',
      TrackName: 'Up next',
      TrackArtist: 'DJ X',
      ContextUri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq',
      Duration: 5302,
      Position: 203,
      RawMetadata: { agentic_product_type: 'dj', is_narration: 'true' },
    }
    const song = {
      ...baseWire,
      TrackUri: 'spotify:track:shared1',
      TrackName: 'Joshua Tree',
      TrackArtist: 'Cautious Clay',
      ContextUri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq',
      Duration: 197551,
      Position: 357,
      RawMetadata: { agentic_product_type: 'dj' },
    }

    // both in one act(), so React collapses them into a single render
    await act(async () => {
      fireEvent({ type: 'observer_track_changed', data: narration } as ApiEvent)
      fireEvent({ type: 'observer_track_changed', data: song } as ApiEvent)
    })

    // status shows the song, which is what made the DJ screen never appear...
    expect(result.current.status).toMatchObject({ track_name: 'Joshua Tree' })
    // ...but the narration survived, so the hold can still be armed from it
    expect(result.current.narration).toEqual({
      uri: 'spotify:media:shared1',
      trackId: 'shared1',
      ms: 5099,
      title: 'Up next',
      artist: 'DJ X',
    })
  })

  // an outro carries the id of the song it follows; an intro carries the id of the song ahead
  const outgoingSong = {
    ...baseWire,
    TrackUri: 'spotify:track:outgoing1',
    TrackName: 'Automatic',
    TrackArtist: 'half•alive',
    ContextUri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq',
    Duration: 192210,
    Position: 25978,
    RawMetadata: { agentic_product_type: 'dj' },
  }
  const outroNarration = {
    ...baseWire,
    TrackUri: 'spotify:media:outgoing1',
    TrackName: 'Up next',
    TrackArtist: 'DJ X',
    ContextUri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq',
    Duration: 2377,
    Position: 0,
    RawMetadata: { agentic_product_type: 'dj', is_narration: 'true' },
  }

  it('ignores an outro still queued at position 0, then captures it once it moves', async () => {
    // an outro sits current but silent for ~3.9s; arming from it would spend the hold on silence
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))
    const { result } = renderHook(() => useObserver())

    await act(async () => {
      fireEvent({ type: 'observer_track_changed', data: outgoingSong } as ApiEvent)
      fireEvent({ type: 'observer_track_changed', data: outroNarration } as ApiEvent)
    })
    expect(result.current.narration).toBeNull()

    await act(async () => {
      fireEvent({
        type: 'observer_state_changed',
        data: { ...outroNarration, Position: 3 },
      } as ApiEvent)
    })
    expect(result.current.narration).toMatchObject({
      uri: 'spotify:media:outgoing1',
      trackId: 'outgoing1',
      ms: 2374,
    })
  })

  it('still reads an outro as an outro on its later events', async () => {
    // the narration must not overwrite lastSongId, or the second event looks like an intro
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))
    const { result } = renderHook(() => useObserver())

    await act(async () => {
      fireEvent({ type: 'observer_track_changed', data: outgoingSong } as ApiEvent)
      fireEvent({ type: 'observer_track_changed', data: outroNarration } as ApiEvent)
    })
    await act(async () => {
      fireEvent({ type: 'observer_state_changed', data: outroNarration } as ApiEvent)
    })

    expect(result.current.narration).toBeNull()
  })

  it('captures an intro narration immediately, even at position 0', async () => {
    // an intro starts speaking at once, so withholding the card only adds latency
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))
    const { result } = renderHook(() => useObserver())

    const intro = {
      ...outroNarration,
      TrackUri: 'spotify:media:incoming2',
      Duration: 0,
      Position: 0,
    }

    await act(async () => {
      fireEvent({ type: 'observer_track_changed', data: outgoingSong } as ApiEvent)
      fireEvent({ type: 'observer_track_changed', data: intro } as ApiEvent)
    })

    // duration 0 falls back to the default guess
    expect(result.current.narration).toMatchObject({
      uri: 'spotify:media:incoming2',
      trackId: 'incoming2',
      ms: 5000,
    })
  })

  it('keeps the narration record while ordinary songs stream past', async () => {
    server.use(http.get('*/observer/status', () => new Promise(() => undefined)))
    const { result } = renderHook(() => useObserver())

    const narration = {
      ...baseWire,
      TrackUri: 'spotify:media:shared1',
      TrackName: 'Up next',
      TrackArtist: 'DJ X',
      Duration: 4597,
      Position: 253,
      RawMetadata: { agentic_product_type: 'dj', is_narration: 'true' },
    }

    await act(async () => {
      fireEvent({ type: 'observer_track_changed', data: narration } as ApiEvent)
    })
    expect(result.current.narration?.uri).toBe('spotify:media:shared1')

    await act(async () => {
      fireEvent({
        type: 'observer_state_changed',
        data: { ...baseWire, Position: 9000 },
      } as ApiEvent)
    })
    // a plain status must not erase it
    expect(result.current.narration?.uri).toBe('spotify:media:shared1')
  })
})
