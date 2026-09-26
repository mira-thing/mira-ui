import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Screensaver } from '../Screensaver'

describe('Screensaver', () => {
  it('shows the clock and date with date placed below', () => {
    const { container } = render(<Screensaver onClose={vi.fn()} utcOffsetMin={0} />)
    const clockEl = container.querySelector('[class*="clock"]')
    const dateEl = container.querySelector('[class*="date"]')
    expect(clockEl).toBeInTheDocument()
    expect(dateEl).toBeInTheDocument()
    expect(clockEl?.textContent).toMatch(/\d{1,2}:\d{2}/)
    // Confirm clock comes before date in the DOM order
    expect(clockEl?.compareDocumentPosition(dateEl!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('dismisses on tap release, not on press, so the tap cannot land on the ui below', () => {
    const onClose = vi.fn()
    const { container } = render(<Screensaver onClose={onClose} utcOffsetMin={0} />)
    const overlay = container.firstElementChild as HTMLElement

    fireEvent.pointerDown(overlay)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('swallows other keys and closes', () => {
    const onClose = vi.fn()
    render(<Screensaver onClose={onClose} utcOffsetMin={0} />)
    fireEvent.keyDown(window, { code: 'ArrowLeft' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss on power key (KeyM) keydown or keyup', () => {
    const onClose = vi.fn()
    render(<Screensaver onClose={onClose} utcOffsetMin={0} />)
    fireEvent.keyDown(window, { code: 'KeyM' })
    fireEvent.keyUp(window, { code: 'KeyM' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not render now-playing pill when no track is playing', () => {
    const { container } = render(<Screensaver onClose={vi.fn()} utcOffsetMin={0} />)
    expect(container.querySelector('[class*="nowPlayingDock"]')).toBeNull()
  })

  it('shows now-playing track and artist when provided', () => {
    const { container } = render(
      <Screensaver
        onClose={vi.fn()}
        utcOffsetMin={0}
        artUrl="https://example.com/art.jpg"
        trackName="Night Drive"
        trackArtist="Mira"
      />,
    )
    expect(screen.getByText('Night Drive')).toBeInTheDocument()
    expect(screen.getByText('Mira')).toBeInTheDocument()
    expect(container.querySelector('[class*="thumb"]')).toBeInTheDocument()
    expect(container.querySelector('[class*="noThumb"]')).toBeNull()
  })

  it('renders track without artist and applies noThumb when artwork is missing', () => {
    const { container } = render(
      <Screensaver onClose={vi.fn()} utcOffsetMin={0} trackName="Solo Track" artUrl={null} />,
    )
    expect(screen.getByText('Solo Track')).toBeInTheDocument()
    expect(container.querySelector('[class*="thumb"]')).toBeNull()
    expect(container.querySelector('[class*="noThumb"]')).toBeInTheDocument()
  })
})
