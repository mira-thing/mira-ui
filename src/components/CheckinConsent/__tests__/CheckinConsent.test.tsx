import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, REVERSAL_GAP_MS, withRouter } from '@/__tests__/hardware'
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

  describe('knob rotation', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('clockwise selects the right-hand choice', () => {
      const onChoose = vi.fn()
      render(<CheckinConsent onChoose={onChoose} />, { wrapper: withRouter })
      hw.turn(1)
      hw.press()
      expect(onChoose).toHaveBeenCalledWith('denied')
    })

    it('counter-clockwise goes back to the left-hand choice', () => {
      const onChoose = vi.fn()
      render(<CheckinConsent onChoose={onChoose} />, { wrapper: withRouter })
      hw.turn(1)
      act(() => vi.advanceTimersByTime(REVERSAL_GAP_MS))
      hw.turn(-1)
      hw.press()
      expect(onChoose).toHaveBeenCalledWith('granted')
    })
  })

  it('back does not dismiss - an explicit choice is required', () => {
    const onChoose = vi.fn()
    render(<CheckinConsent onChoose={onChoose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onChoose).not.toHaveBeenCalled()
    expect(screen.getByText('One quick thing')).toBeInTheDocument()
  })
})
