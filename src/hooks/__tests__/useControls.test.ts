import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useControls } from '../useControls'
import { server } from '../../__tests__/msw-server'

describe('useControls endpoint dispatch', () => {
  it('routes each transport command to its dedicated endpoint', async () => {
    const hits: Record<string, number> = {
      resume: 0,
      pause: 0,
      next: 0,
      prev: 0,
      playpause: 0,
    }
    server.use(
      http.post('*/player/resume', () => {
        hits.resume++
        return HttpResponse.json({})
      }),
      http.post('*/player/pause', () => {
        hits.pause++
        return HttpResponse.json({})
      }),
      http.post('*/player/next', () => {
        hits.next++
        return HttpResponse.json({})
      }),
      http.post('*/player/prev', () => {
        hits.prev++
        return HttpResponse.json({})
      }),
      http.post('*/player/playpause', () => {
        hits.playpause++
        return HttpResponse.json({})
      }),
    )

    const { result } = renderHook(() => useControls())

    await Promise.all([
      result.current.play(),
      result.current.pause(),
      result.current.next(),
      result.current.prev(),
      result.current.togglePlayPause(),
    ])

    expect(hits).toEqual({
      resume: 1,
      pause: 1,
      next: 1,
      prev: 1,
      playpause: 1,
    })
  })

  it('sends seek with a rounded, non-negative position in the body', async () => {
    // Math.round for fractional ms, Math.max(0,...) for clock-step negatives
    const bodies: unknown[] = []
    server.use(
      http.post('*/player/seek', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({})
      }),
    )

    const { result } = renderHook(() => useControls())

    await result.current.seek(42_500.7)
    await result.current.seek(-1_000)

    expect(bodies).toEqual([{ position: 42_501 }, { position: 0 }])
  })

  it('sends setShuffle with the documented body shape', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('*/player/shuffle_context', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({})
      }),
    )

    const { result } = renderHook(() => useControls())

    await result.current.setShuffle(true)
    await result.current.setShuffle(false)

    expect(bodies).toEqual([{ shuffle_context: true }, { shuffle_context: false }])
  })

  it('sends djSignal to its endpoint without a body', async () => {
    let hits = 0
    let contentType: string | null = null
    server.use(
      http.post('*/player/dj_signal', ({ request }) => {
        hits++
        contentType = request.headers.get('content-type')
        return HttpResponse.json({})
      }),
    )

    const { result } = renderHook(() => useControls())

    await result.current.djSignal()

    expect(hits).toBe(1)
    // momentary action: no payload, so no json content-type is set
    expect(contentType).toBeNull()
  })

  it('sends setRepeat to both repeat endpoints with mode-derived flags', async () => {
    const contextBodies: unknown[] = []
    const trackBodies: unknown[] = []
    server.use(
      http.post('*/player/repeat_context', async ({ request }) => {
        contextBodies.push(await request.json())
        return HttpResponse.json({})
      }),
      http.post('*/player/repeat_track', async ({ request }) => {
        trackBodies.push(await request.json())
        return HttpResponse.json({})
      }),
    )

    const { result } = renderHook(() => useControls())

    await result.current.setRepeat('off')
    await result.current.setRepeat('context')
    await result.current.setRepeat('track')

    expect(contextBodies).toEqual([
      { repeat_context: false },
      { repeat_context: true },
      { repeat_context: false },
    ])
    expect(trackBodies).toEqual([
      { repeat_track: false },
      { repeat_track: false },
      { repeat_track: true },
    ])
  })

  it('rejects command errors so callers can show feedback', async () => {
    server.use(
      http.post('*/player/resume', () => new HttpResponse(null, { status: 500 })),
      http.post('*/player/pause', () => HttpResponse.error()),
    )

    const { result } = renderHook(() => useControls())

    await expect(result.current.play()).rejects.toThrow('/player/resume: 500')
    await expect(result.current.pause()).rejects.toThrow()
  })
})
