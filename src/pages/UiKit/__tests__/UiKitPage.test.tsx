import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, REVERSAL_GAP_MS, withRouter } from '@/__tests__/hardware'
import { createRouteBack, RouteBackContext } from '@/app/routeBack'
import type { KnobStep } from '@/input/knob'
import { Layer } from '@/input/router'
import { useKnobScope } from '@/input/useKnobScope'
import { __resetSettings } from '@/settings'
import { applyUiScale } from '@/uiScale'
import { UiKitPage } from '../UiKitPage'

// stands in for the volume, which sits under every page
function Base({ onStep }: { onStep: () => void }) {
  useKnobScope({ layer: Layer.base, enabled: true, onStep, onSelect: onStep })
  return null
}

function renderKit() {
  const routeBack = createRouteBack()
  const base = vi.fn()
  const view = render(
    <RouteBackContext.Provider value={routeBack}>
      <Base onStep={base} />
      <UiKitPage />
    </RouteBackContext.Provider>,
    { wrapper: withRouter },
  )
  return { ...view, routeBack, base }
}

const cards = () => screen.getAllByRole('option').slice(0, 5)
const focusedCard = () => cards().find((c) => c.getAttribute('aria-selected') === 'true')

describe('UiKitPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    __resetSettings()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.getElementById('root')?.remove()
  })

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
  const turn = (n: number, dir: KnobStep) => {
    hw.turnSteps(n, dir, { advance })
    advance(REVERSAL_GAP_MS)
  }

  it('drives the carousel with the knob, and opens the focused card on a press', () => {
    const { base } = renderKit()
    expect(focusedCard()).toHaveTextContent('Playlists')

    turn(1, 1)
    expect(focusedCard()).toHaveTextContent('Queue')
    hw.press()
    expect(screen.getByText('Opened Queue')).toBeInTheDocument()
    expect(base).not.toHaveBeenCalled()
  })

  it('opens a card on tap', () => {
    renderKit()
    fireEvent.click(cards()[3])
    expect(screen.getByText('Opened Bluetooth')).toBeInTheDocument()
  })

  it('hands the knob to the list, and never lets it reach the volume', () => {
    const { base } = renderKit()
    fireEvent.click(screen.getByRole('button', { name: 'list' }))

    turn(1, 1)
    expect(focusedCard()).toHaveTextContent('Playlists')
    expect(screen.getAllByRole('option')[6]).toHaveAttribute('aria-selected', 'true')
    expect(base).not.toHaveBeenCalled()
  })

  it('takes Back to close an open dialog, then lets it through', () => {
    const { routeBack, base } = renderKit()
    fireEvent.click(screen.getByRole('button', { name: 'Solid' }))
    expect(screen.getByRole('dialog', { name: 'Solid dialog' })).toBeInTheDocument()

    turn(1, 1)
    expect(focusedCard()).toHaveTextContent('Playlists')
    expect(base).not.toHaveBeenCalled()

    let took = false
    act(() => {
      took = routeBack.run()
    })
    expect(took).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(routeBack.run()).toBe(false)
  })

  it('shows glass and solid dialogs side by side', () => {
    renderKit()
    fireEvent.click(screen.getByRole('button', { name: 'Side by side' }))

    expect(screen.getByRole('dialog', { name: 'Glass' })).toHaveClass('glass')
    expect(screen.getByRole('dialog', { name: 'Solid' })).toHaveClass('solid')
  })

  it('zooms without saving, and restores the saved zoom on leaving', () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    applyUiScale(100)
    const { unmount } = renderKit()

    fireEvent.click(screen.getByRole('button', { name: '115' }))
    expect(root.style.getPropertyValue('zoom')).toBe(String(800 / 696))
    expect(localStorage.getItem('mira.settings.v1')).toBeNull()

    unmount()
    expect(root.style.getPropertyValue('zoom')).toBe('')
  })

  it('shows the zoom applied from elsewhere, even between the notches', () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    applyUiScale(100)
    renderKit()
    expect(screen.getByRole('button', { name: '100' })).toHaveAttribute('aria-pressed', 'true')

    act(() => applyUiScale(95))
    expect(screen.getByRole('button', { name: '95' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '100' })).toHaveAttribute('aria-pressed', 'false')

    act(() => applyUiScale(115))
    expect(screen.queryByRole('button', { name: '95' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '115' })).toHaveAttribute('aria-pressed', 'true')
  })
})
