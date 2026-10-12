import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from '..'

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <Dialog open={false} surface="solid">
        body
      </Dialog>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('draws the solid card flat, with no glass', () => {
    render(
      <Dialog open surface="solid" title="Restart?" width="sm">
        body
      </Dialog>,
    )
    const card = screen.getByRole('dialog', { name: 'Restart?' })
    expect(card).toHaveClass('card', 'solid', 'sm')
    expect(card).not.toHaveClass('surface')
    expect(card.parentElement).toHaveClass('scrim')
  })

  it('draws the glass card as an uncached floating surface', () => {
    render(
      <Dialog open surface="glass" title="Restart?">
        body
      </Dialog>,
    )
    const card = screen.getByRole('dialog', { name: 'Restart?' })
    expect(card).toHaveClass('surface', 'floating', 'card', 'glass', 'md')
    expect(card).not.toHaveAttribute('data-glass-panel')
    expect(screen.getByRole('heading', { name: 'Restart?' })).toBeInTheDocument()
  })

  it('closes on a scrim tap, but not on a tap inside the card', () => {
    const onClose = vi.fn()
    render(
      <Dialog open surface="glass" onClose={onClose}>
        <button type="button">inside</button>
      </Dialog>,
    )
    fireEvent.click(screen.getByText('inside'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
