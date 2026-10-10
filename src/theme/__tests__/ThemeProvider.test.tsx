import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import type { ArtworkColors, RGB } from '@/hooks/useColorExtract'
import { ThemeProvider } from '../ThemeProvider'
import { useTheme, useThemeSource, type ThemeInput } from '../theme'

const ALBUM_A: RGB[] = [
  [220, 40, 50],
  [30, 160, 150],
  [120, 110, 90],
]
const ALBUM_B: RGB[] = [[30, 160, 150]]

// what useArtworkColors reports per url; anything unlisted is still being sampled
let colours: Record<string, ArtworkColors> = {}
vi.mock('@/hooks/useColorExtract', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useArtworkColors: (url: string | undefined): ArtworkColors =>
    !url ? { palette: null, pending: false } : (colours[url] ?? { palette: null, pending: true }),
}))

beforeEach(() => {
  colours = {
    a: { palette: ALBUM_A, pending: false },
    b: { palette: ALBUM_B, pending: false },
    broken: { palette: null, pending: false },
  }
})

function source(initial: ThemeInput) {
  return renderHook((input: ThemeInput) => useThemeSource(input), { initialProps: initial })
}

describe('useThemeSource', () => {
  it('follows the album while there is art', () => {
    const { result, rerender } = source({ art: 'a' })
    expect(result.current.source).toBe('album')
    expect(result.current.palette).toBe(ALBUM_A)
    rerender({ art: 'b' })
    expect(result.current.palette).toBe(ALBUM_B)
  })

  it('is idle with no art and no DJ', () => {
    const { result, rerender } = source({ art: '' })
    expect(result.current.source).toBe('idle')
    expect(result.current.palette).toEqual([])
    rerender({ art: 'a' })
    rerender({ art: undefined })
    expect(result.current.source).toBe('idle')
  })

  it('holds the last album while the DJ talks over blank art', () => {
    const { result, rerender } = source({ art: 'a' })
    rerender({ art: '', narrating: true })
    expect(result.current.source).toBe('album')
    expect(result.current.palette).toBe(ALBUM_A)
  })

  it('stays idle when the DJ starts talking with no album shown', () => {
    const { result, rerender } = source({ art: '' })
    rerender({ art: '', narrating: true })
    expect(result.current.source).toBe('idle')
  })

  it('holds the last album while the next cover is sampled', () => {
    const { result, rerender } = source({ art: 'a' })
    rerender({ art: 'sampling' })
    expect(result.current.palette).toBe(ALBUM_A)
    colours.sampling = { palette: ALBUM_B, pending: false }
    rerender({ art: 'sampling' })
    expect(result.current.palette).toBe(ALBUM_B)
  })

  it('goes idle when the cover cannot be read', () => {
    const { result, rerender } = source({ art: 'a' })
    rerender({ art: 'broken' })
    expect(result.current.source).toBe('idle')
  })

  it('does not bring an old album back after idle', () => {
    const { result, rerender } = source({ art: 'a' })
    rerender({ art: '' })
    rerender({ art: 'sampling' })
    expect(result.current.source).toBe('idle')
  })
})

// the paints the player drew for ALBUM_A before the theme moved out of it
const ALBUM_A_PAINTS = [
  'radial-gradient(closest-side, rgb(17, 52, 49) 0%, rgba(17, 52, 49, 0.97) 10%, rgba(17, 52, 49, 0.72) 30%, rgba(17, 52, 49, 0.34) 52%, rgba(17, 52, 49, 0.09) 74%, rgba(17, 52, 49, 0.015) 90%, rgba(17, 52, 49, 0) 100%)',
  'radial-gradient(closest-side, rgba(92, 23, 27, 0.9) 0%, rgba(92, 23, 27, 0.873) 10%, rgba(92, 23, 27, 0.648) 30%, rgba(92, 23, 27, 0.306) 52%, rgba(92, 23, 27, 0.081) 74%, rgba(92, 23, 27, 0.013) 90%, rgba(92, 23, 27, 0) 100%)',
  'radial-gradient(closest-side, rgba(110, 98, 74, 0.85) 0%, rgba(110, 98, 74, 0.825) 10%, rgba(110, 98, 74, 0.612) 30%, rgba(110, 98, 74, 0.289) 52%, rgba(110, 98, 74, 0.076) 74%, rgba(110, 98, 74, 0.013) 90%, rgba(110, 98, 74, 0) 100%)',
  'radial-gradient(closest-side, rgba(237, 29, 40, 0.28) 0%, rgba(237, 29, 40, 0.09) 45%, rgba(237, 29, 40, 0) 100%)',
]

function Probe() {
  const theme = useTheme()
  return <span data-testid="probe" data-source={theme.source} />
}

describe('ThemeProvider', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const root = (container: HTMLElement) => container.firstElementChild as HTMLElement
  const layers = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('.ground > .layer'))
  const paints = (layer: HTMLElement) =>
    Array.from(layer.children).map((c) => (c as HTMLElement).style.backgroundImage)

  it('writes the album roles on its root as rgb triplets', () => {
    const { container } = render(<ThemeProvider art="a" className="shell" />)
    const el = root(container)
    expect(el).toHaveClass('shell')
    expect(el.dataset.theme).toBe('album')
    // the old inline values: --surface-tint rgba(99, 23, 27, a), depth fill rgb(33, 18, 19)
    expect(el.style.getPropertyValue('--theme-tint')).toBe('99, 23, 27')
    expect(el.style.getPropertyValue('--theme-depth')).toBe('33, 18, 19')
    expect(el.style.getPropertyValue('--theme-glow')).toBe('237, 29, 40')
  })

  it('paints the album orbs exactly as the player did', () => {
    const { container } = render(<ThemeProvider art="a" />)
    const [front, back] = layers(container)
    expect(paints(front)).toEqual(ALBUM_A_PAINTS)
    expect(paints(back)).toEqual(ALBUM_A_PAINTS)
    expect(front).toHaveClass('visible')
    expect(container.querySelector('.idle')).toHaveClass('hidden')
  })

  it('shows the idle layer, over mounted but hidden scenes, when idle', () => {
    const { container } = render(<ThemeProvider />)
    const el = root(container)
    expect(el.dataset.theme).toBe('idle')
    expect(el.style.getPropertyValue('--theme-tint')).toBe('0, 0, 0')
    expect(el.style.getPropertyValue('--theme-depth')).toBe('0, 0, 0')
    const [front, back] = layers(container)
    expect(front).toHaveClass('hidden')
    expect(back).toHaveClass('hidden')
    expect(front.querySelectorAll('.orb')).toHaveLength(3)
    expect(container.querySelector('.idle')).toHaveClass('visible')
  })

  it('crossfades from idle into the album when art arrives', () => {
    const { container, rerender } = render(<ThemeProvider />)
    rerender(<ThemeProvider art="a" />)
    act(() => vi.advanceTimersByTime(16))
    const [, back] = layers(container)
    expect(back).toHaveClass('visible')
    expect(paints(back)).toEqual(ALBUM_A_PAINTS)
    expect(container.querySelector('.idle')).toHaveClass('hidden')
  })

  it('provides the theme to its children', () => {
    const { getByTestId } = render(
      <ThemeProvider art="a">
        <Probe />
      </ThemeProvider>,
    )
    expect(getByTestId('probe').dataset.source).toBe('album')
  })
})
