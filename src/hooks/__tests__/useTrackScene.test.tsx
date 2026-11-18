import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTrackScene } from '../useTrackScene'
import { loadArtwork } from '../useColorExtract'
import { activeStatus } from '@/__tests__/fixtures/observer'
import type { ObserverStatusActive } from '@/api/types'
import type { TrackTransition } from '../usePlayerControls'

vi.mock('../useColorExtract', () => ({ loadArtwork: vi.fn() }))
const track = (id: string) => ({ ...activeStatus, track_id: id, track_image: `/${id}.jpg` })
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(loadArtwork).mockReset()
})
afterEach(() => vi.useRealTimers())

function sceneElements() {
  const root = document.createElement('div')
  const view = document.createElement('div')
  view.dataset.trackActive = 'true'
  const elements = [document.createElement('div'), document.createElement('div')]
  elements.forEach((el) => {
    el.dataset.trackMotion = ''
    view.appendChild(el)
  })
  root.appendChild(view)
  const animate = vi.fn((_frames: unknown, options: KeyframeAnimationOptions) => {
    const animation = { onfinish: null as (() => void) | null, cancel: () => clearTimeout(timer) }
    const timer = setTimeout(() => animation.onfinish?.(), Number(options.duration))
    return animation as unknown as Animation
  })
  elements.forEach((el) => {
    el.animate = animate
  })
  return { root, elements, animate }
}

it('holds the outgoing track until artwork is ready', async () => {
  const ready: ((image: HTMLImageElement | null) => void)[] = []
  vi.mocked(loadArtwork).mockImplementation(() => new Promise((resolve) => ready.push(resolve)))
  const { result, rerender } = renderHook(({ status }) => useTrackScene(status, false), {
    initialProps: { status: track('a') },
  })
  rerender({ status: track('b') })
  expect(result.current.pending).toBe(false)
  rerender({ status: track('c') })
  await act(async () => ready[0](null))
  expect(result.current.status?.track_id).toBe('a')
  await act(async () => ready[1](null))
  expect(result.current.status?.track_id).toBe('c')
  expect(result.current.pending).toBe(false)
  rerender({ status: { ...track('c'), position: 12345 } })
  expect(result.current.status?.position).toBe(12345)
})

it('holds a track announced bare until its title and cover arrive', async () => {
  vi.mocked(loadArtwork).mockResolvedValue(null)
  const { result, rerender } = renderHook(({ status }) => useTrackScene(status, false), {
    initialProps: { status: track('a') },
  })
  const bare = { ...track('b'), track_name: '', track_image: '' }
  await act(async () => rerender({ status: bare }))
  await act(async () => vi.advanceTimersByTimeAsync(900))
  expect(result.current.status?.track_id).toBe('a')

  await act(async () => rerender({ status: track('b') }))
  expect(result.current.status?.track_id).toBe('b')
  expect(result.current.status?.track_image).toBe('/b.jpg')
})

it('shows a bare track once its title or cover is plainly not coming', async () => {
  vi.mocked(loadArtwork).mockResolvedValue(null)
  const { result, rerender } = renderHook(({ status }) => useTrackScene(status, false), {
    initialProps: { status: track('a') },
  })
  await act(async () => rerender({ status: { ...track('b'), track_image: '' } }))
  await act(async () => vi.advanceTimersByTimeAsync(1999))
  expect(result.current.status?.track_id).toBe('a')
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(result.current.status?.track_id).toBe('b')
})

it('holds a bare track no longer for its title arriving before its cover', async () => {
  vi.mocked(loadArtwork).mockResolvedValue(null)
  const { result, rerender } = renderHook(({ status }) => useTrackScene(status, false), {
    initialProps: { status: track('a') },
  })
  await act(async () => rerender({ status: { ...track('b'), track_name: '', track_image: '' } }))
  await act(async () => vi.advanceTimersByTimeAsync(1900))
  await act(async () => rerender({ status: { ...track('b'), track_image: '' } }))
  await act(async () => vi.advanceTimersByTimeAsync(100))
  expect(result.current.status?.track_id).toBe('b')
})

it('does not hold a DJ narration, which speaks at once and may have no cover', async () => {
  vi.mocked(loadArtwork).mockResolvedValue(null)
  const { result, rerender } = renderHook(({ status }) => useTrackScene(status, false), {
    initialProps: { status: track('a') },
  })
  const narration = { ...track('dj'), track_uri: 'spotify:media:dj', track_image: '' }
  await act(async () => rerender({ status: narration }))
  expect(result.current.status?.track_id).toBe('dj')
})

describe('a Next from the device', () => {
  const queued = (id: string) => ({
    uri: `spotify:track:${id}`,
    track_id: id,
    name: `Song ${id}`,
    artist: 'Artist',
    album: 'Album',
    image_url: `https://i.scdn.co/image/ab67616d00004851${id}`,
  })
  const playing: ObserverStatusActive = { ...track('a'), next_tracks: [queued('b'), queued('c')] }
  const skip = { fromTrackId: 'a', at: 0, direction: -1 as const }

  it('shows the queued track at once, undimmed, before Spotify confirms it', async () => {
    vi.mocked(loadArtwork).mockResolvedValue(null)
    const { result, rerender } = renderHook(
      ({ status, waiting, request }) => useTrackScene(status, waiting, request),
      { initialProps: { status: playing, waiting: false, request: null as typeof skip | null } },
    )
    await act(async () => rerender({ status: playing, waiting: true, request: skip }))
    expect(result.current.status).toMatchObject({
      track_id: 'b',
      track_name: 'Song b',
      track_image: 'https://i.scdn.co/image/ab67616d00001e02b',
      position: 0,
    })
    expect(result.current.pending).toBe(false)

    const confirmed = { ...track('b'), track_image: 'https://i.scdn.co/image/ab67616d00001e02b' }
    await act(async () => rerender({ status: confirmed, waiting: false, request: skip }))
    expect(result.current.status?.track_id).toBe('b')
  })

  it('steps further down the queue on a second Next', async () => {
    vi.mocked(loadArtwork).mockResolvedValue(null)
    const { result, rerender } = renderHook(
      ({ request }) => useTrackScene(playing, true, request),
      { initialProps: { request: skip } },
    )
    await act(async () => rerender({ request: { ...skip, at: 1 } }))
    expect(result.current.status?.track_id).toBe('c')
  })

  it('goes back to what is playing when the skip fails', async () => {
    vi.mocked(loadArtwork).mockResolvedValue(null)
    const { result, rerender } = renderHook(
      ({ waiting, request }) => useTrackScene(playing, waiting, request),
      { initialProps: { waiting: true, request: skip } },
    )
    expect(result.current.status?.track_id).toBe('b')
    await act(async () => rerender({ waiting: false, request: skip }))
    expect(result.current.status?.track_id).toBe('b')
    await act(async () => vi.advanceTimersByTimeAsync(2000))
    expect(result.current.status?.track_id).toBe('a')
  })

  it('keeps the queued track while Spotify is slow to confirm the skip', async () => {
    vi.mocked(loadArtwork).mockResolvedValue(null)
    const { result, rerender } = renderHook(
      ({ status, waiting }) => useTrackScene(status, waiting, skip),
      { initialProps: { status: playing, waiting: true } },
    )
    await act(async () => rerender({ status: playing, waiting: false }))
    await act(async () => vi.advanceTimersByTimeAsync(1500))
    const confirmed = { ...track('b'), track_image: 'https://i.scdn.co/image/ab67616d00001e02b' }
    await act(async () => rerender({ status: confirmed, waiting: false }))
    await act(async () => vi.advanceTimersByTimeAsync(3000))
    expect(result.current.status?.track_id).toBe('b')
  })

  it('does not carry the old track length onto the queued one', async () => {
    vi.mocked(loadArtwork).mockResolvedValue(null)
    const { result } = renderHook(() => useTrackScene(playing, true, skip))
    expect(result.current.status).toMatchObject({ track_id: 'b', duration: 0 })
  })
})

describe('a Previous from the device', () => {
  const played = (id: string) => ({
    uri: `spotify:track:${id}`,
    track_id: id,
    name: `Song ${id}`,
    artist: 'Artist',
    album: 'Album',
    image_url: `/${id}.jpg`,
  })
  const back: TrackTransition = { fromTrackId: 'b', at: 0, direction: 1 }

  async function playedThrough(prev: ReturnType<typeof played>[]) {
    vi.mocked(loadArtwork).mockResolvedValue(null)
    const a = { ...track('a'), track_name: 'Song a' }
    const b = {
      ...track('b'),
      track_name: 'Song b',
      prev_tracks: prev,
      position: 0,
      received_at: Date.now(),
    }
    const hook = renderHook(
      ({ status, waiting, request }) => useTrackScene(status, waiting, request),
      {
        initialProps: {
          status: a as ObserverStatusActive,
          waiting: false,
          request: null as typeof back | null,
        },
      },
    )
    hook.rerender({ status: b, waiting: false, request: null })
    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(hook.result.current.status?.track_id).toBe('b')
    return { ...hook, b }
  }

  it('shows the track it showed before at once, undimmed', async () => {
    const { result, rerender, b } = await playedThrough([played('z'), played('a')])
    await act(async () => rerender({ status: b, waiting: true, request: back }))
    expect(result.current.status).toMatchObject({
      track_id: 'a',
      track_name: 'Song a',
      position: 0,
    })
    expect(result.current.pending).toBe(false)
  })

  it('keeps the title when Spotify confirms the track bare', async () => {
    const { result, rerender, b } = await playedThrough([played('z'), played('a')])
    await act(async () => rerender({ status: b, waiting: true, request: back }))
    const bare = { ...track('a'), track_name: '', track_artist: '', track_image: '' }
    await act(async () => rerender({ status: bare, waiting: false, request: back }))
    expect(result.current.status).toMatchObject({
      track_id: 'a',
      track_name: 'Song a',
      track_image: '/a.jpg',
    })
  })

  it('trusts a full prev list that may have dropped the last track', async () => {
    const full = Array.from({ length: 10 }, (_, i) => played(`old${i}`))
    const { result, rerender, b } = await playedThrough(full)
    await act(async () => rerender({ status: b, waiting: true, request: back }))
    expect(result.current.status?.track_id).toBe('a')
  })

  it('waits for Spotify when the prev list says it lands elsewhere', async () => {
    const { result, rerender, b } = await playedThrough([played('a'), played('y')])
    await act(async () => rerender({ status: b, waiting: true, request: back }))
    expect(result.current.status?.track_id).toBe('b')
    expect(result.current.pending).toBe(true)
  })

  it('leaves a Previous mid-track to Spotify, which restarts the track', async () => {
    const { result, rerender, b } = await playedThrough([played('a')])
    const midway = { ...b, position: 30_000 }
    await act(async () => rerender({ status: midway, waiting: true, request: back }))
    expect(result.current.status?.track_id).toBe('b')
    await act(async () =>
      rerender({ status: midway, waiting: true, request: { ...back, fromStart: true } }),
    )
    expect(result.current.status?.track_id).toBe('a')
  })

  it('does not guess while the scene still trails what is playing', async () => {
    const { result, rerender } = await playedThrough([played('a')])
    const c = { ...track('c'), track_image: '', prev_tracks: [played('a'), played('b')] }
    await act(async () => rerender({ status: c, waiting: false, request: null }))
    expect(result.current.status?.track_id).toBe('b')
    await act(async () =>
      rerender({ status: c, waiting: true, request: { ...back, fromTrackId: 'c' } }),
    )
    expect(result.current.status?.track_id).toBe('b')
  })
})

it('shows each confirmed track during a burst, dimmed until the last', async () => {
  vi.mocked(loadArtwork).mockResolvedValue(null)
  const { result, rerender } = renderHook(({ status, waiting }) => useTrackScene(status, waiting), {
    initialProps: { status: track('a'), waiting: false },
  })
  rerender({ status: track('a'), waiting: true })
  await act(async () => rerender({ status: track('b'), waiting: true }))
  expect(result.current.status?.track_id).toBe('b')
  expect(result.current.pending).toBe(true)
  await act(async () => rerender({ status: track('c'), waiting: false }))
  expect(result.current.status?.track_id).toBe('c')
  expect(result.current.pending).toBe(false)
})

it.each([true, false])(
  'settles both cover and text immediately on release, pending=%s',
  async (pending) => {
    const { result, rerender } = renderHook(({ waiting }) => useTrackScene(track('a'), waiting), {
      initialProps: { waiting: false },
    })
    const { root, elements, animate } = sceneElements()
    result.current.ref.current = root
    act(() => {
      result.current.drag(-180)
      vi.advanceTimersByTime(20)
    })
    expect(elements[0].style.transform).toBe(elements[1].style.transform)
    expect(elements[0].style.transform).not.toBe('translateX(0px)')
    act(() => result.current.release())
    rerender({ waiting: pending })
    expect(result.current.pending).toBe(pending)
    await act(async () => vi.advanceTimersByTimeAsync(220))
    elements.forEach((el) => expect(el.style.transform).toBe('translateX(0px)'))
    expect(animate).toHaveBeenCalledTimes(2) // one settle per element
    expect(root.style.transform).toBe('')
    expect(root.style.opacity).toBe('')
    rerender({ waiting: false }) // a timeout clears the dim without moving
    expect(result.current.pending).toBe(false)
    expect(animate).toHaveBeenCalledTimes(2)
  },
)
