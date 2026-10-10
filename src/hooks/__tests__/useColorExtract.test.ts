import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useArtworkColors, useDominantColors, type RGB } from '../useColorExtract'

// each test uses its own urls: the sample cache is module-wide
const COLOURS: Record<string, RGB> = {
  'https://art/red-1': [220, 40, 50],
  'https://art/red-2': [220, 40, 50],
  'https://art/teal-2': [30, 160, 150],
  'https://art/red-3': [220, 40, 50],
}

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  crossOrigin = ''
  decoding = ''
  referrerPolicy = ''
  #src = ''
  get src() {
    return this.#src
  }
  set src(url: string) {
    this.#src = url
    window.setTimeout(() => (COLOURS[url] ? this.onload?.() : this.onerror?.()), 0)
  }
}

// a solid fill of whatever image was drawn last
let drawn: RGB = [0, 0, 0]
const context = {
  imageSmoothingEnabled: true,
  clearRect() {},
  drawImage(img: FakeImage) {
    drawn = COLOURS[img.src]
  },
  getImageData(_x: number, _y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) data.set([...drawn, 255], i)
    return { data }
  },
}

beforeAll(() => {
  vi.stubGlobal('Image', FakeImage)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400)
  })
}

describe('useDominantColors', () => {
  it('is null without art', () => {
    expect(renderHook(() => useDominantColors(undefined)).result.current).toBeNull()
    expect(renderHook(() => useDominantColors('')).result.current).toBeNull()
    expect(renderHook(() => useArtworkColors(undefined)).result.current).toEqual({
      palette: null,
      pending: false,
    })
  })

  it('is the sampled palette once the art is read', async () => {
    const { result } = renderHook(() => useDominantColors('https://art/red-1'))
    expect(result.current).toBeNull()
    await settle()
    expect(result.current?.[0]).toEqual(expect.any(Array))
  })
})

describe('useArtworkColors', () => {
  it('never returns the previous art palette for a new, unsampled url', async () => {
    const { result, rerender } = renderHook(({ url }) => useArtworkColors(url), {
      initialProps: { url: 'https://art/red-2' },
    })
    await settle()
    const red = result.current.palette
    expect(red).not.toBeNull()

    rerender({ url: 'https://art/teal-2' })
    expect(result.current).toEqual({ palette: null, pending: true })

    await settle()
    expect(result.current.pending).toBe(false)
    expect(result.current.palette).not.toBeNull()
    expect(result.current.palette).not.toEqual(red)
  })

  it('goes back to null when the art goes away', async () => {
    const { result, rerender } = renderHook(({ url }) => useArtworkColors(url), {
      initialProps: { url: 'https://art/red-3' as string | undefined },
    })
    await settle()
    expect(result.current.palette).not.toBeNull()
    rerender({ url: undefined })
    expect(result.current).toEqual({ palette: null, pending: false })
  })

  it('samples a url afresh when it comes back, rather than replaying its old miss', async () => {
    const { result, rerender } = renderHook(({ url }) => useArtworkColors(url), {
      initialProps: { url: 'https://art/broken-2' as string | undefined },
    })
    await settle()
    expect(result.current).toEqual({ palette: null, pending: false })
    rerender({ url: undefined })
    rerender({ url: 'https://art/broken-2' })
    expect(result.current).toEqual({ palette: null, pending: true })
  })

  it('settles to no palette when the art cannot be read', async () => {
    const { result } = renderHook(() => useArtworkColors('https://art/broken'))
    expect(result.current.pending).toBe(true)
    await settle()
    expect(result.current).toEqual({ palette: null, pending: false })
  })
})
