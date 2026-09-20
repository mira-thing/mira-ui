import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Screensaver } from '../Screensaver'

describe('Screensaver', () => {
  it('shows the clock', () => {
    render(<Screensaver onClose={vi.fn()} utcOffsetMin={0} />)
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
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

  it('does not dismiss on power key (KeyM)', () => {
    const onClose = vi.fn()
    render(<Screensaver onClose={onClose} utcOffsetMin={0} />)
    fireEvent.keyDown(window, { code: 'KeyM' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows now-playing track and artist when provided', () => {
    render(
      <Screensaver
        onClose={vi.fn()}
        utcOffsetMin={0}
        trackName="Night Drive"
        trackArtist="Mira"
      />,
    )
    expect(screen.getByText('Night Drive')).toBeInTheDocument()
    expect(screen.getByText('Mira')).toBeInTheDocument()
  })
})
