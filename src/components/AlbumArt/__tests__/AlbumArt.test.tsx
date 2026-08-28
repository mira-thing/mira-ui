import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlbumArt } from '../AlbumArt'

describe('AlbumArt', () => {
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
