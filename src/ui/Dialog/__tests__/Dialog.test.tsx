import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { hw, withRouter } from '@/__tests__/hardware'
import { createRouteBack, RouteBackContext } from '@/app/routeBack'
import { Layer } from '@/input/router'
import { useKnobScope } from '@/input/useKnobScope'
import { Dialog } from '..'

// a page under the dialog, holding the knob the way a list does
function Behind({ onKnob }: { onKnob: () => void }) {
  useKnobScope({ layer: Layer.page, enabled: true, onStep: onKnob, onSelect: onKnob })
  return null
}

function renderOver(dialog: (open: boolean) => ReactNode) {
  const routeBack = createRouteBack()
  const behind = vi.fn()
  const tree = (open: boolean) => (
    <RouteBackContext.Provider value={routeBack}>
      <Behind onKnob={behind} />
      {dialog(open)}
    </RouteBackContext.Provider>
  )
  const view = render(tree(true), { wrapper: withRouter })
  return { routeBack, behind, setOpen: (open: boolean) => view.rerender(tree(open)) }
}

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

  it('holds the knob while open, and hands it back once closed', () => {
    const { behind, setOpen } = renderOver((open) => <Dialog open={open} surface="solid" />)

    hw.turn(1)
    hw.press()
    expect(behind).not.toHaveBeenCalled()

    setOpen(false)
    hw.press()
    expect(behind).toHaveBeenCalledOnce()
  })

  it('closes on Back while open, and leaves Back alone once closed', () => {
    const onClose = vi.fn()
    const { routeBack, setOpen } = renderOver((open) => (
      <Dialog open={open} surface="solid" onClose={onClose} />
    ))

    let took = false
    act(() => {
      took = routeBack.run()
    })
    expect(took).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()

    setOpen(false)
    expect(routeBack.run()).toBe(false)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('leaves Back alone without an onClose', () => {
    const { routeBack } = renderOver((open) => <Dialog open={open} surface="solid" />)
    expect(routeBack.run()).toBe(false)
  })
})
