import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { PlayerPage, type PlayerPageProps } from '../PlayerPage'
import { OverlayContext } from '@/overlays/overlayContext'
import { useOverlays } from '@/hooks/useOverlays'
import { server } from '@/__tests__/msw-server'
import { activeStatus } from '@/__tests__/fixtures/observer'
import type { UsePlayerControlsResult } from '@/hooks/usePlayerControls'
import type { DJNarration } from '@/hooks/useDJNarration'

function controls(over: Partial<UsePlayerControlsResult> = {}): UsePlayerControlsResult {
  return {
    isPaused: false,
    shuffle: false,
    repeat: 'off',
    transitioning: false,
    onPlayPause: vi.fn(),
    onPrev: vi.fn(),
    onPrevTrack: vi.fn(),
    onNext: vi.fn(),
    onToggleShuffle: vi.fn(),
    onDJSignal: vi.fn(),
    onCycleRepeat: vi.fn(),
    ...over,
  }
}

const silent: DJNarration = { narrating: false, title: '', artist: '' }

function props(over: Partial<PlayerPageProps> = {}): PlayerPageProps {
  return {
    status: activeStatus,
    controls: controls(),
    narration: silent,
    showLyrics: true,
    bannerReason: null,
    carriers: null,
    pairing: null,
    seek: vi.fn(async () => {}),
    notify: vi.fn(),
    ...over,
  }
}

// the page reads the stack through useOverlayState, which throws outside a
// provider. a real stack rather than a fake, so "More opens the menu" asserts
// on the menu actually arriving
function Harness({ children }: { children: ReactNode }) {
  const overlays = useOverlays()
  return <OverlayContext.Provider value={overlays}>{children}</OverlayContext.Provider>
}

function renderPage(p: PlayerPageProps = props(), children?: ReactNode) {
  // setup.ts runs msw with onUnhandledRequest: 'error', and neither call the
  // player makes is in the default handler set
  server.use(
    http.get('*/player/saved', () => HttpResponse.json({ saved: false })),
    http.get('*/lyrics/*', () => HttpResponse.json({ lines: [] })),
  )
  return render(<Harness>{<PlayerPage {...p}>{children}</PlayerPage>}</Harness>)
}

describe('PlayerPage', () => {
  it('shows the track in both view layers, which stay mounted to cross-fade', () => {
    const { container } = renderPage()

    expect(screen.getAllByText('Test Song').length).toBe(2)
    expect(screen.getAllByText('Test Artist').length).toBe(2)
    expect(container.querySelectorAll('.viewLayer').length).toBe(2)
  })

  it('makes the lyrics layer the active one when lyrics are on', () => {
    const { container } = renderPage(props({ showLyrics: true }))

    const active = container.querySelector('.viewLayer.viewActive')
    expect(active?.querySelector('.top')).toBeInTheDocument()
    expect(container.querySelector('.viewLayer.viewInactive .topNoLyrics')).toBeInTheDocument()
  })

  it('makes the art layer the active one when lyrics are off', () => {
    const { container } = renderPage(props({ showLyrics: false }))

    const active = container.querySelector('.viewLayer.viewActive')
    expect(active?.querySelector('.topNoLyrics')).toBeInTheDocument()
    expect(container.querySelector('.viewLayer.viewInactive .top')).toBeInTheDocument()
  })

  it('hands the narration to the subtree, which shows the DJ instead of the track', () => {
    // NoLyricsView and Controls read this off NarrationContext, not off props,
    // so nothing else proves the provider wraps them
    renderPage(props({ narration: { narrating: true, title: 'DJ X', artist: 'Spotify' } }))

    expect(screen.getAllByText('DJ X').length).toBeGreaterThan(0)
    expect(screen.queryByText('Test Song')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to Liked Songs' })).toBeDisabled()
  })

  it('raises the reconnect banner for a drop reason', () => {
    renderPage(props({ bannerReason: 'offline' }))
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
  })

  it('stays quiet with no drop to report', () => {
    renderPage(props({ bannerReason: null }))
    expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument()
  })

  it('renders the overlay host inside the player container, not beside it', () => {
    const { container } = renderPage(props(), <div data-testid="overlay-host" />)

    const app = container.querySelector('.app')
    expect(app?.querySelector('[data-testid="overlay-host"]')).toBeInTheDocument()
  })

  it('opens the menu from More', async () => {
    // the sheet stays mounted to animate, so `open` shows up as aria-hidden
    // rather than as presence — query the role, which honours that
    renderPage()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('drives the transport through the controls it was handed', async () => {
    const c = controls()
    renderPage(props({ controls: c }))

    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))

    expect(c.onPlayPause).toHaveBeenCalledOnce()
    expect(c.onNext).toHaveBeenCalledOnce()
    expect(c.onPrev).toHaveBeenCalledOnce()
  })

  it('treats an episode as a podcast: no save, and skips instead of shuffle', () => {
    renderPage(props({ status: { ...activeStatus, track_uri: 'spotify:episode:pod' } }))

    expect(screen.queryByRole('button', { name: 'Add to Liked Songs' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rewind 15 seconds' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Shuffle' })).not.toBeInTheDocument()
  })

  it('skips relative to where playback is, and clamps to the episode', async () => {
    // paused, so the elapsed-since-received term drops out and the target is exact
    const seek = vi.fn(async () => {})
    const paused = { ...activeStatus, track_uri: 'spotify:episode:pod', is_paused: true }
    renderPage(props({ status: paused, seek }))

    await userEvent.click(screen.getByRole('button', { name: 'Forward 15 seconds' }))
    expect(seek).toHaveBeenLastCalledWith(45_000)

    await userEvent.click(screen.getByRole('button', { name: 'Rewind 15 seconds' }))
    expect(seek).toHaveBeenLastCalledWith(15_000)
  })

  it('will not skip back past the start', async () => {
    const seek = vi.fn(async () => {})
    const nearStart = {
      ...activeStatus,
      track_uri: 'spotify:episode:pod',
      is_paused: true,
      position: 3_000,
    }
    renderPage(props({ status: nearStart, seek }))

    await userEvent.click(screen.getByRole('button', { name: 'Rewind 15 seconds' }))
    expect(seek).toHaveBeenLastCalledWith(0)
  })
})
