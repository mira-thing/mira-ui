import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useTrackScene } from '../useTrackScene'
import { loadArtwork } from '../useColorExtract'
import { activeStatus } from '@/__tests__/fixtures/observer'

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
