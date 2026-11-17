import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let resized: ResizeObserverCallback = () => {}
let created = 0
const createObjectURL = vi.fn(() => `blob:${++created}`)
const revokeObjectURL = vi.fn()

class LoadingImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private source = ''
  set src(value: string) {
    this.source = value
    setTimeout(() => this.onload?.(), 0)
  }
  get src() {
    return this.source
  }
  decode() {
    return Promise.resolve()
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  })
  created = 0
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  vi.stubGlobal('Image', LoadingImage)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resized = callback
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage() {},
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob()))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function panel(width: number) {
  const el = document.createElement('div')
  el.setAttribute('data-glass-panel', '')
  el.style.width = `${width}px`
  el.style.height = '50px'
  return el
}

async function cached(...panels: HTMLElement[]) {
  const { usePanelPaintCache } = await import('../usePanelPaintCache')
  const host = document.createElement('div')
  host.append(...panels)
  document.body.append(host)
  const hook = renderHook(() => usePanelPaintCache({ current: host }, 'layout', 1))
  await settle()
  return { host, ...hook }
}

const settle = () => vi.advanceTimersByTimeAsync(400)
const paintOf = (el: HTMLElement) => el.style.getPropertyValue('--glass-paint')
const resize = (...els: HTMLElement[]) =>
  resized(
    els.map((target) => ({ target }) as unknown as ResizeObserverEntry),
    {} as ResizeObserver,
  )

describe('usePanelPaintCache', () => {
  it('swaps a resized panel to a paint already built for that size, with no new URLs', async () => {
    const narrow = panel(100)
    const wide = panel(200)
    await cached(narrow, wide)
    expect(createObjectURL).toHaveBeenCalledTimes(4)

    narrow.style.width = '200px'
    resize(narrow)
    expect(paintOf(narrow)).toBe(paintOf(wide))
    expect(createObjectURL).toHaveBeenCalledTimes(4)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('never revokes a paint a panel still shows, and frees the rest past the limit', async () => {
    const panels = Array.from({ length: 10 }, (_, i) => panel(100 + i))
    const { unmount } = await cached(...panels)
    expect(panels.map((p) => paintOf(p) !== '')).toEqual(panels.map(() => true))
    expect(revokeObjectURL).not.toHaveBeenCalled()

    unmount()
    expect(revokeObjectURL).toHaveBeenCalledTimes(4)
  })

  it('drops a panel that left the page without holding back a new one', async () => {
    const leaving = panel(100)
    const { host } = await cached(leaving)
    const entering = panel(300)
    host.append(entering)
    await vi.advanceTimersByTimeAsync(200)

    leaving.remove()
    resize(leaving)
    expect(paintOf(leaving)).toBe('')
    await settle()
    expect(paintOf(entering)).not.toBe('')
  })
})
