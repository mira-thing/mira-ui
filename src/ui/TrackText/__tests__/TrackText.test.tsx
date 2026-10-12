import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrackText } from '../TrackText'

describe('TrackText', () => {
  it('falls back to placeholder text', () => {
    render(<TrackText title="" artist="" size="panel" />)
    expect(screen.getByText('Unknown track')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
  })

  it('ellipsizes instead of scrolling when scroll is off', () => {
    const { container } = render(
      <TrackText title="Song" artist="Artist" size="mini" scroll={false} />,
    )
    expect(container.firstElementChild).toHaveClass('text', 'mini')
    expect(screen.getByText('Song')).toHaveClass('line', 'title')
    expect(container.querySelector('.wrap')).toBeNull()
  })

  it('scrolls through a marquee by default', () => {
    const { container } = render(<TrackText title="Song" artist="Artist" size="hero" />)
    expect(container.querySelectorAll('.wrap')).toHaveLength(2)
  })
})
