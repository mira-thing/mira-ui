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
