import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { AlbumArt } from '../AlbumArt'
import { loadArtwork } from '@/hooks/useColorExtract'

vi.mock('@/hooks/useColorExtract', () => ({ loadArtwork: vi.fn() }))

describe('AlbumArt', () => {
  it('keeps the image until its replacement loads and ignores old covers', async () => {
    const ready: ((image: HTMLImageElement | null) => void)[] = []
    vi.mocked(loadArtwork).mockImplementation(() => new Promise((resolve) => ready.push(resolve)))
    const { container, rerender } = render(<AlbumArt src="/a.jpg" />)
    const shown = () => container.querySelector('[aria-hidden="false"] img')?.getAttribute('src')
    rerender(<AlbumArt src="/b.jpg" />)
    expect(shown()).toBe('/a.jpg')
    rerender(<AlbumArt src="/c.jpg" />)
    await act(async () => ready[0](new Image()))
    expect(shown()).toBe('/a.jpg')
    await act(async () => ready[1](new Image()))
    expect(shown()).toBe('/c.jpg')
    expect(container.querySelector('img[src="/a.jpg"]')).not.toBeNull() // outgoing fade layer
  })
  it('shows the DJ mark instead of an empty box when djFallback is set', () => {
    render(<AlbumArt src="" djFallback={true} />)
    // both crossfade layers render the fallback, so the mark is present twice
    expect(screen.getAllByRole('img', { name: 'DJ' }).length).toBeGreaterThan(0)
  })

  it('does not show the DJ mark by default', () => {
    render(<AlbumArt src="" />)
    expect(screen.queryByRole('img', { name: 'DJ' })).toBeNull()
  })

  it('renders the artwork when a src is given, even with djFallback set', () => {
    // narration suppresses src at the call site, so a src here means real artwork
    const { container } = render(<AlbumArt src="https://x/art.jpg" alt="cover" djFallback={true} />)
    expect(container.querySelector('img[src="https://x/art.jpg"]')).not.toBeNull()
  })
})
