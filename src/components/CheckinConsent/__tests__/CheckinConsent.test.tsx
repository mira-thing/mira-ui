import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CheckinConsent } from '../CheckinConsent'

describe('CheckinConsent', () => {
  it('renders the pitch and both choices', () => {
    render(<CheckinConsent onChoose={vi.fn()} />)
    expect(screen.getByText('One quick thing')).toBeInTheDocument()
    expect(screen.getByText('Sounds good')).toBeInTheDocument()
    expect(screen.getByText('No thanks')).toBeInTheDocument()
  })

  it('reports granted from the accept button', () => {
    const onChoose = vi.fn()
    render(<CheckinConsent onChoose={onChoose} />)
    fireEvent.click(screen.getByText('Sounds good'))
    expect(onChoose).toHaveBeenCalledWith('granted')
  })

  it('reports denied from the decline button', () => {
    const onChoose = vi.fn()
    render(<CheckinConsent onChoose={onChoose} />)
    fireEvent.click(screen.getByText('No thanks'))
    expect(onChoose).toHaveBeenCalledWith('denied')
  })

  it('knob press confirms the default selection', () => {
    const onChoose = vi.fn()
    render(<CheckinConsent onChoose={onChoose} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onChoose).toHaveBeenCalledWith('granted')
  })

  it('knob rotation moves the selection before confirming', () => {
    const onChoose = vi.fn()
    render(<CheckinConsent onChoose={onChoose} />)
    fireEvent.wheel(window, { deltaX: 60 })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onChoose).toHaveBeenCalledWith('denied')
  })

  it('back does not dismiss - an explicit choice is required', () => {
    const onChoose = vi.fn()
    render(<CheckinConsent onChoose={onChoose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onChoose).not.toHaveBeenCalled()
    expect(screen.getByText('One quick thing')).toBeInTheDocument()
  })
})
