import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Controls } from '../Controls'
import { NarrationContext } from '@/hooks/useDJNarration'

// presentational only, optimistic + double-tap logic lives in usePlayerControls
function defaultProps() {
  return {
    isPaused: true,
    shuffle: false,
    repeat: 'off' as const,
    disallowPrev: false,
    disallowNext: false,
    onPrev: vi.fn(),
    onPlayPause: vi.fn(),
    onNext: vi.fn(),
    onMore: vi.fn(),
    onToggleShuffle: vi.fn(),
    onCycleRepeat: vi.fn(),
  }
}

describe('Controls', () => {
  it('renders the play icon when paused, swaps to pause when playing', () => {
    const { rerender } = render(<Controls {...defaultProps()} isPaused={true} />)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()

    rerender(<Controls {...defaultProps()} isPaused={false} />)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
  })

  it('routes each button click to its matching callback exactly once', () => {
    const props = defaultProps()
    render(<Controls {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Repeat off' }))
    fireEvent.click(screen.getByRole('button', { name: 'More' }))

    expect(props.onToggleShuffle).toHaveBeenCalledTimes(1)
    expect(props.onPrev).toHaveBeenCalledTimes(1)
    expect(props.onPlayPause).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)
    expect(props.onCycleRepeat).toHaveBeenCalledTimes(1)
    expect(props.onMore).toHaveBeenCalledTimes(1)
  })

  it('disables and swallows clicks on prev when disallowPrev is true', () => {
    const props = defaultProps()
    render(<Controls {...props} disallowPrev={true} />)

    const prev = screen.getByRole('button', { name: 'Previous' })
    expect(prev).toBeDisabled()
    expect(prev).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(prev)
    expect(props.onPrev).not.toHaveBeenCalled()
  })

  it('disables and swallows clicks on next when disallowNext is true', () => {
    const props = defaultProps()
    render(<Controls {...props} disallowNext={true} />)

    const nextBtn = screen.getByRole('button', { name: 'Next' })
    expect(nextBtn).toBeDisabled()
    expect(nextBtn).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(nextBtn)
    expect(props.onNext).not.toHaveBeenCalled()
  })

  it('swaps shuffle for the DJ button while a DJ set plays', () => {
    const props = { ...defaultProps(), onDJSignal: vi.fn() }
    render(<Controls {...props} isDJ={true} />)

    expect(screen.queryByRole('button', { name: 'Shuffle' })).toBeNull()
    const dj = screen.getByRole('button', { name: 'Switch DJ set' })

    // momentary action, so it must not advertise itself as a toggle
    expect(dj).not.toHaveAttribute('aria-pressed')

    fireEvent.click(dj)
    expect(props.onDJSignal).toHaveBeenCalledTimes(1)
    expect(props.onToggleShuffle).not.toHaveBeenCalled()
  })

  it('keeps the shuffle button when isDJ is false', () => {
    const props = { ...defaultProps(), onDJSignal: vi.fn() }
    render(<Controls {...props} isDJ={false} />)

    expect(screen.queryByRole('button', { name: 'Switch DJ set' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle' }))
    expect(props.onToggleShuffle).toHaveBeenCalledTimes(1)
    expect(props.onDJSignal).not.toHaveBeenCalled()
  })

  it('disables repeat for the whole DJ set', () => {
    const props = { ...defaultProps(), onDJSignal: vi.fn() }
    render(<Controls {...props} isDJ={true} repeat="off" />)

    const repeat = screen.getByRole('button', { name: 'Repeat off' })
    expect(repeat).toBeDisabled()
    expect(repeat).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(repeat)
    expect(props.onCycleRepeat).not.toHaveBeenCalled()
  })

  it('keeps repeat usable outside a DJ set', () => {
    const props = defaultProps()
    render(<Controls {...props} isDJ={false} />)

    const repeat = screen.getByRole('button', { name: 'Repeat off' })
    expect(repeat).not.toBeDisabled()
    fireEvent.click(repeat)
    expect(props.onCycleRepeat).toHaveBeenCalledTimes(1)
  })

  it('lets podcast mode win over DJ mode in the shuffle slot', () => {
    // a DJ set is never an episode, but the branch order must still be deterministic
    const props = { ...defaultProps(), onDJSignal: vi.fn(), onRewind15: vi.fn() }
    render(<Controls {...props} isPodcast={true} isDJ={true} />)

    expect(screen.queryByRole('button', { name: 'Switch DJ set' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Rewind 15 seconds' })).toBeInTheDocument()
  })

  it('labels the repeat button by mode (off/context/track)', () => {
    // 'track' renders RepeatOneIcon, others render RepeatIcon the accessible name is the user-facing discriminator
    const { rerender } = render(<Controls {...defaultProps()} repeat="off" />)
    expect(screen.getByRole('button', { name: 'Repeat off' })).toBeInTheDocument()

    rerender(<Controls {...defaultProps()} repeat="context" />)
    expect(screen.getByRole('button', { name: 'Repeat context' })).toBeInTheDocument()

    rerender(<Controls {...defaultProps()} repeat="track" />)
    expect(screen.getByRole('button', { name: 'Repeat track' })).toBeInTheDocument()
  })
})

describe('Controls save button during narration', () => {
  const narrating = { narrating: true, title: 'Up next', artist: 'DJ X' }

  // showSave defaults to false, so the save wiring has to be passed explicitly
  function saveProps(over: Record<string, unknown> = {}) {
    return { ...defaultProps(), showSave: true, saved: false, onToggleSaved: vi.fn(), ...over }
  }

  it('disables the save button and ignores presses while the DJ is on screen', () => {
    const props = saveProps()
    render(
      <NarrationContext.Provider value={narrating}>
        <Controls {...props} />
      </NarrationContext.Provider>,
    )

    const save = screen.getByRole('button', { name: 'Add to Liked Songs' })
    expect(save).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(save)
    expect(props.onToggleSaved).not.toHaveBeenCalled()
  })

  it('does not show a saved heart while the DJ is on screen', () => {
    // the narration uri is not a saveable track, so a filled heart would be describing nothing
    render(
      <NarrationContext.Provider value={narrating}>
        <Controls {...saveProps({ saved: true })} />
      </NarrationContext.Provider>,
    )

    expect(screen.getByRole('button', { name: 'Add to Liked Songs' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('stays usable during ordinary playback', () => {
    const props = saveProps()
    render(<Controls {...props} />)

    const save = screen.getByRole('button', { name: 'Add to Liked Songs' })
    expect(save).toHaveAttribute('aria-disabled', 'false')

    fireEvent.click(save)
    expect(props.onToggleSaved).toHaveBeenCalledTimes(1)
  })
})
