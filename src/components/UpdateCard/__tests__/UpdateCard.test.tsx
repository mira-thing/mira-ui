import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpdateCard } from '../UpdateCard'

describe('UpdateCard', () => {
  it('shows the new version', () => {
    render(<UpdateCard latest="1.1.0" onRemindLater={vi.fn()} />)
    expect(screen.getByText('Update available')).toBeInTheDocument()
    expect(screen.getByText(/1\.1\.0 is out/)).toBeInTheDocument()
  })

  it('lists at most three release highlights', () => {
    render(
      <UpdateCard
        latest="1.1.0"
        highlights={['Screensaver', 'Progress bar', 'BT fixes', 'A fourth thing']}
        onRemindLater={vi.fn()}
      />,
    )
    expect(screen.getByText('Screensaver')).toBeInTheDocument()
    expect(screen.getByText('BT fixes')).toBeInTheDocument()
    expect(screen.queryByText('A fourth thing')).not.toBeInTheDocument()
  })

  it('offers only remind-me-later when no skip handler is given', () => {
    const onRemindLater = vi.fn()
    render(<UpdateCard latest="1.1.0" onRemindLater={onRemindLater} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByText('Remind me later'))
    expect(onRemindLater).toHaveBeenCalled()
  })

  it('offers skip alongside remind-me-later on a normal release', () => {
    const onSkip = vi.fn()
    render(<UpdateCard latest="1.1.0" onRemindLater={vi.fn()} onSkip={onSkip} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    fireEvent.click(screen.getByText('Skip this version'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('drops skip on a mandatory release but keeps remind-me-later', () => {
    const onRemindLater = vi.fn()
    const onSkip = vi.fn()
    render(<UpdateCard latest="1.1.2" mandatory onRemindLater={onRemindLater} onSkip={onSkip} />)
    expect(screen.queryByText('Skip this version')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByText('Remind me later'))
    expect(onRemindLater).toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('starts on remind-me-later and confirms it with the knob', () => {
    const onRemindLater = vi.fn()
    const onSkip = vi.fn()
    render(<UpdateCard latest="1.1.0" onRemindLater={onRemindLater} onSkip={onSkip} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onRemindLater).toHaveBeenCalledTimes(1)
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('turning the knob right moves the selection to skip', () => {
    const onRemindLater = vi.fn()
    const onSkip = vi.fn()
    render(<UpdateCard latest="1.1.0" onRemindLater={onRemindLater} onSkip={onSkip} />)
    fireEvent.wheel(window, { deltaY: 1 })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onRemindLater).not.toHaveBeenCalled()
  })
})
