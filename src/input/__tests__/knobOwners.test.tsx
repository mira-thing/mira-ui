import type { ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activeStatus } from '@/__tests__/fixtures/observer'
import { hw, withRouter } from '@/__tests__/hardware'
import { CheckinConsent } from '@/components/CheckinConsent'
import { Screensaver } from '@/components/Screensaver'
import { UpdateCard } from '@/components/UpdateCard'
import { useHardwareButtons, type UseHardwareButtonsParams } from '@/hooks/useHardwareButtons'

function params(over: Partial<UseHardwareButtonsParams> = {}): UseHardwareButtonsParams {
  return {
    status: { ...activeStatus, volume: 30000 },
    onPlayPause: vi.fn(),
    setVolume: vi.fn(),
    playContext: vi.fn(),
    inDJSet: false,
    djNarrating: false,
    onDJSignal: vi.fn(),
    onBack: vi.fn(),
    onTogglePowerMenu: vi.fn(),
    onScreensaver: vi.fn(),
    onOpenDebug: vi.fn(),
    notify: vi.fn(),
    ...over,
  }
}

// the hardware hook sits in App with every overlay rendered under it
function Device({ p, children }: { p: UseHardwareButtonsParams; children?: ReactNode }) {
  const { volumeOverlay } = useHardwareButtons(p)
  return (
    <>
      {volumeOverlay.visible ? <div data-testid="volume" /> : null}
      {children}
    </>
  )
}

describe('knob owners over the hardware buttons', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

  it('lets the consent card take the knob without touching the volume', () => {
    const p = params()
    const onChoose = vi.fn()
    render(
      <Device p={p}>
        <CheckinConsent onChoose={onChoose} />
      </Device>,
      { wrapper: withRouter },
    )

    hw.turn(1)
    advance(200)
    expect(screen.getByText('No thanks')).toHaveClass('btnFocus')
    expect(screen.queryByTestId('volume')).not.toBeInTheDocument()
    expect(p.setVolume).not.toHaveBeenCalled()

    hw.press()
    expect(onChoose).toHaveBeenCalledWith('denied')
    expect(p.onPlayPause).not.toHaveBeenCalled()

    hw.back()
    expect(p.onBack).not.toHaveBeenCalled()
  })

  it('lets the update card take the knob without touching the volume', () => {
    const p = params()
    const onSkip = vi.fn()
    render(
      <Device p={p}>
        <UpdateCard latest="1.1.0" onRemindLater={vi.fn()} onSkip={onSkip} />
      </Device>,
      { wrapper: withRouter },
    )

    hw.turn(1)
    advance(200)
    expect(p.setVolume).not.toHaveBeenCalled()
    hw.press()
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(p.onPlayPause).not.toHaveBeenCalled()
  })

  it('keeps the knob off the volume under a mandatory update card', () => {
    const p = params()
    const onRemindLater = vi.fn()
    render(
      <Device p={p}>
        <UpdateCard latest="1.1.2" mandatory onRemindLater={onRemindLater} />
      </Device>,
      { wrapper: withRouter },
    )

    hw.turn(1)
    advance(200)
    expect(p.setVolume).not.toHaveBeenCalled()
    hw.press()
    expect(onRemindLater).toHaveBeenCalledTimes(1)
    expect(p.onPlayPause).not.toHaveBeenCalled()
  })

  it('hands the knob back to the volume once the consent card closes', () => {
    const p = params()
    const { rerender } = render(
      <Device p={p}>
        <CheckinConsent onChoose={vi.fn()} />
      </Device>,
      { wrapper: withRouter },
    )

    hw.turn(1)
    advance(200)
    rerender(<Device p={p} />)
    hw.turn(1)
    advance(200)
    expect(p.setVolume).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('volume')).toBeInTheDocument()
  })

  it('plays or pauses on a knob press under the screensaver without closing it', () => {
    const p = params()
    const onClose = vi.fn()
    render(
      <Device p={p}>
        <Screensaver onClose={onClose} onPlayPause={p.onPlayPause} utcOffsetMin={0} />
      </Device>,
      { wrapper: withRouter },
    )

    hw.press()
    expect(p.onPlayPause).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not press a card button left under the screensaver', () => {
    const p = params()
    const onRemindLater = vi.fn()
    const onClose = vi.fn()
    render(
      <Device p={p}>
        <UpdateCard latest="1.1.0" onRemindLater={onRemindLater} onSkip={vi.fn()} />
        <Screensaver onClose={onClose} onPlayPause={p.onPlayPause} utcOffsetMin={0} />
      </Device>,
      { wrapper: withRouter },
    )

    hw.press()
    expect(p.onPlayPause).toHaveBeenCalledTimes(1)
    expect(onRemindLater).not.toHaveBeenCalled()
  })
})
