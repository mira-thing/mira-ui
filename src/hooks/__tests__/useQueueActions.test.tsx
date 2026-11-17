import { act, renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/__tests__/msw-server'
import { NotifyContext } from '@/notify/notifyContext'
import { useQueueActions } from '../useQueueActions'

const URI = 'spotify:track:abc'

function setup() {
  const notify = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NotifyContext.Provider value={notify}>{children}</NotifyContext.Provider>
  )
  const { result } = renderHook(() => useQueueActions(), { wrapper })
  return { notify, result }
}

describe('useQueueActions', () => {
  it('queues through the default handler and banners success', async () => {
    const { notify, result } = setup()

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.add(URI)
    })

    expect(ok).toBe(true)
    expect(notify).toHaveBeenCalledWith('Added to the queue', { variant: 'success', icon: 'queue' })
  })

  it('posts the uri and names the track in the banner', async () => {
    const seen: unknown[] = []
    server.use(
      http.post('*/player/add_to_queue', async ({ request }) => {
        seen.push(await request.json())
        return HttpResponse.json({})
      }),
    )
    const { notify, result } = setup()

    await act(async () => {
      await result.current.add(URI, 'Test Song')
    })

    expect(seen).toEqual([{ uri: URI }])
    expect(notify).toHaveBeenCalledWith('Added Test Song to the queue', {
      variant: 'success',
      icon: 'queue',
    })
  })

  it('banners an error and resolves false when the daemon refuses', async () => {
    server.use(http.post('*/player/add_to_queue', () => new HttpResponse(null, { status: 500 })))
    const { notify, result } = setup()

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.add(URI)
    })

    expect(ok).toBe(false)
    expect(notify).toHaveBeenCalledWith("Couldn't add to the queue", { variant: 'error' })
  })

  it('ignores a second add of the same uri while the first is on its way', async () => {
    const calls = vi.fn()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post('*/player/add_to_queue', async () => {
        calls()
        await gate
        return HttpResponse.json({})
      }),
    )
    const { notify, result } = setup()

    let first: Promise<boolean> = Promise.resolve(false)
    let second: boolean | undefined
    await act(async () => {
      first = result.current.add(URI)
      second = await result.current.add(URI)
    })
    expect(second).toBe(false)

    release()
    await act(async () => {
      expect(await first).toBe(true)
    })
    expect(calls).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledTimes(1)

    // once it lands, the same track may be queued again on purpose
    await act(async () => {
      expect(await result.current.add(URI)).toBe(true)
    })
    expect(calls).toHaveBeenCalledTimes(2)
  })

  it('holds the guard across hook instances, so a remounted row cannot queue twice', async () => {
    const calls = vi.fn()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post('*/player/add_to_queue', async () => {
        calls()
        await gate
        return HttpResponse.json({})
      }),
    )
    const first = setup()
    const second = setup()

    let pending: Promise<boolean> = Promise.resolve(false)
    await act(async () => {
      pending = first.result.current.add(URI)
      expect(await second.result.current.add(URI)).toBe(false)
    })
    release()
    await act(async () => {
      expect(await pending).toBe(true)
    })
    expect(calls).toHaveBeenCalledTimes(1)
  })
})
