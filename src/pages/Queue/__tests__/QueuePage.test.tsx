import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { hw, REVERSAL_GAP_MS, withRouter } from '@/__tests__/hardware'
import type { KnobStep } from '@/input/knob'
import type { QueueTrack } from '@/api/types'
import type { Overlays } from '@/hooks/useOverlays'
import { OverlayContext } from '@/overlays/overlayContext'
import { QueuePage, type QueuePageProps } from '../QueuePage'

const now = { title: 'Now Song', artist: 'Now Artist', art: 'https://art/now', djFallback: false }

const track = (n: number, over: Partial<QueueTrack> = {}): QueueTrack => ({
  uri: `spotify:track:t${n}`,
  track_id: `t${n}`,
  name: `Song ${n}`,
  artist: `Artist ${n}`,
  album: `Album ${n}`,
  image_url: `https://art/${n}`,
  ...over,
})

function setup(props: Partial<QueuePageProps> = {}, { busy = false } = {}) {
  const overlays = { busy } as unknown as Overlays
  const wrapper = ({ children }: { children: ReactNode }) =>
    withRouter({
      children: <OverlayContext.Provider value={overlays}>{children}</OverlayContext.Provider>,
    })
  const ui = (p: Partial<QueuePageProps>) => (
    <QueuePage nowPlaying={now} upNext={[]} {...props} {...p} />
  )
  const view = render(ui({}), { wrapper })
  return { ...view, update: (p: Partial<QueuePageProps>) => view.rerender(ui(p)) }
}

const rows = () => screen.queryAllByRole('option')
const focused = () => rows().find((r) => r.getAttribute('aria-selected') === 'true')

describe('QueuePage', () => {
  it('shows what is playing over the tracks up next, from the status', () => {
    setup({ upNext: [track(1), track(2)] })

    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()
    const playing = screen.getByRole('region', { name: 'Now playing' })
    expect(playing).toHaveTextContent('Now Song')
    expect(playing).toHaveTextContent('Now Artist')
    expect(playing.querySelector('img')).toHaveAttribute('src', 'https://art/now')

    expect(screen.getByText('Up next')).toBeInTheDocument()
    expect(screen.getByText('2 up next')).toBeInTheDocument()
    expect(rows().map((r) => r.textContent)).toEqual(['Song 1Artist 1', 'Song 2Artist 2'])
    expect(rows()[0].querySelector('img')).toHaveAttribute('src', 'https://art/1')
  })

  it('keeps the Up next label out of the scroller, so scrolling never clips it', () => {
    setup({ upNext: [track(1), track(2)] })
    const label = screen.getByText('Up next')
    expect(label.closest('[role="listbox"]')).toBeNull()
    expect(screen.getByRole('listbox').parentElement).not.toContainElement(label)
  })

  it('reads as the next few, not the whole queue, once the daemon caps it', () => {
    setup({ upNext: Array.from({ length: 10 }, (_, i) => track(i)) })
    expect(screen.getByText('10+ up next')).toBeInTheDocument()
  })

  it('follows the queue as tracks change', () => {
    const { update } = setup({ upNext: [track(1), track(2)] })

    update({
      nowPlaying: { ...now, title: 'Song 1', artist: 'Artist 1' },
      upNext: [track(2), track(3), track(4)],
    })

    expect(screen.getByRole('region', { name: 'Now playing' })).toHaveTextContent('Song 1')
    expect(rows().map((r) => r.textContent)).toEqual([
      'Song 2Artist 2',
      'Song 3Artist 3',
      'Song 4Artist 4',
    ])
    expect(screen.getByText('3 up next')).toBeInTheDocument()
  })

  it('lists a track queued twice as two rows the knob can reach', () => {
    setup({ upNext: [track(1), track(1), track(2)] })

    expect(rows()).toHaveLength(3)
    hw.turn(1)
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true')
    expect(rows()[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('falls back for a track with no art or artist', () => {
    setup({ upNext: [track(1, { image_url: '', artist: '', name: '' })] })
    expect(rows()[0]).toHaveTextContent(/^Unknown track$/)
  })

  it('says nothing is queued while a track plays alone', () => {
    setup({ upNext: [] })
    expect(screen.getByRole('region', { name: 'Now playing' })).toBeInTheDocument()
    expect(screen.getAllByText('Nothing queued')).toHaveLength(2)
    expect(rows()).toHaveLength(0)
  })

  it('says nothing is playing, and drops a stale queue, when idle', () => {
    setup({ nowPlaying: null, upNext: [track(1)] })
    expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Nothing playing')).toHaveLength(2)
    expect(rows()).toHaveLength(0)
  })

  it('walks the rows with the knob, clamped at the ends, and a press does nothing', () => {
    vi.useFakeTimers()
    try {
      const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
      const turn = (n: number, dir: KnobStep) => {
        hw.turnSteps(n, dir, { advance })
        advance(REVERSAL_GAP_MS)
      }
      setup({ upNext: [track(1), track(2), track(3)] })

      expect(focused()).toHaveTextContent('Song 1')
      turn(1, -1)
      expect(focused()).toHaveTextContent('Song 1')
      turn(5, 1)
      expect(focused()).toHaveTextContent('Song 3')
      turn(1, -1)
      expect(focused()).toHaveTextContent('Song 2')
      hw.press()
      expect(focused()).toHaveTextContent('Song 2')
      expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('focuses a tapped row', () => {
    setup({ upNext: [track(1), track(2)] })
    fireEvent.click(rows()[1])
    expect(focused()).toHaveTextContent('Song 2')
  })

  it('leaves the knob alone while an overlay is up', () => {
    setup({ upNext: [track(1), track(2)] }, { busy: true })
    hw.turn(1)
    expect(focused()).toHaveTextContent('Song 1')
  })
})
