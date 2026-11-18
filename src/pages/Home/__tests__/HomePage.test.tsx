import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hw, withRouter } from '@/__tests__/hardware'
import { NavigationContext, type Navigation } from '@/app/navigation'
import type { Overlays } from '@/hooks/useOverlays'
import { useKnobNav } from '@/input/useKnobNav'
import { OverlayContext } from '@/overlays/overlayContext'
import { HomePage, type HomePageProps } from '../HomePage'
import { homeCards, type HomeCardsInput } from '../homeCards'

// counts the page's own renders, which the header clock must not cause
vi.mock('@/input/useKnobNav', async (importOriginal) => {
  const mod = await importOriginal<{ useKnobNav: typeof useKnobNav }>()
  return { ...mod, useKnobNav: vi.fn(mod.useKnobNav) }
})

const track = { title: 'Song', artist: 'Artist', art: '', djFallback: false }

function setup(over: Partial<HomePageProps> = {}, { busy = false } = {}) {
  const nav: Navigation = { push: vi.fn(), pop: vi.fn(() => true), reset: vi.fn() }
  const overlays = { open: vi.fn(), busy } as unknown as Overlays
  const onResume = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) =>
    withRouter({
      children: (
        <OverlayContext.Provider value={overlays}>
          <NavigationContext.Provider value={nav}>{children}</NavigationContext.Provider>
        </OverlayContext.Provider>
      ),
    })
  render(
    <HomePage
      nowPlaying={null}
      connected
      deviceName={null}
      deviceCount={0}
      queueSummary="Nothing queued"
      btDeviceName={null}
      onResume={onResume}
      utcOffsetMin={null}
      {...over}
    />,
    { wrapper },
  )
  return { nav, overlays, onResume }
}

const card = (name: RegExp) => screen.getByRole('option', { name })

describe('homeCards', () => {
  const input: HomeCardsInput = {
    nowPlaying: null,
    deviceName: null,
    deviceCount: 0,
    queueSummary: 'Nothing queued',
    btDeviceName: null,
  }

  it('leads with resume while idle, and with the track while playing', () => {
    expect(homeCards(input).map((c) => c.key)).toEqual([
      'resume',
      'playlists',
      'queue',
      'devices',
      'bluetooth',
      'settings',
    ])
    const [first] = homeCards({ ...input, nowPlaying: track })
    expect(first).toMatchObject({ key: 'now-playing', title: 'Song', subtitle: 'Artist', track })
  })

  it('names the device playing, else how many are in reach', () => {
    const devices = (over: Partial<HomeCardsInput>) =>
      homeCards({ ...input, ...over }).find((c) => c.key === 'devices')?.subtitle
    expect(devices({ deviceName: 'Pixel' })).toBe('Pixel')
    expect(devices({ deviceCount: 2 })).toBe('2 available')
    expect(devices({})).toBe('Open Spotify on your phone')
  })

  it('shows the queue summary it is given', () => {
    const queue = homeCards({ ...input, queueSummary: '3 up next' }).find((c) => c.key === 'queue')
    expect(queue?.subtitle).toBe('3 up next')
  })
})

describe('HomePage', () => {
  it('says nothing is playing, or that it is reconnecting', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Mira' })).toBeInTheDocument()
    expect(screen.getByText('Nothing playing')).toBeInTheDocument()
  })

  it('says where it is playing', () => {
    setup({ nowPlaying: track, deviceName: 'Pixel' })
    expect(screen.getByText('Playing on Pixel')).toBeInTheDocument()
  })

  it('resumes from the first card on a knob press', () => {
    const { onResume } = setup()
    hw.press()
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('returns to the player from the now-playing card', () => {
    const { nav } = setup({ nowPlaying: track })
    hw.press()
    expect(nav.push).toHaveBeenCalledWith({ id: 'player' })
  })

  it('pushes playlists and queue as pages', () => {
    const { nav } = setup()
    fireEvent.click(card(/Playlists/))
    expect(nav.push).toHaveBeenLastCalledWith({ id: 'playlists' })
    fireEvent.click(card(/Queue/))
    expect(nav.push).toHaveBeenLastCalledWith({ id: 'queue' })
  })

  it('opens devices, bluetooth and settings as overlays', () => {
    const { overlays } = setup()
    fireEvent.click(card(/Devices/))
    fireEvent.click(card(/Bluetooth/))
    fireEvent.click(card(/Settings/))
    expect(vi.mocked(overlays.open).mock.calls).toEqual([['deviceMenu'], ['btMenu'], ['settings']])
  })

  it('walks the cards with the knob', () => {
    const { nav } = setup()
    hw.turn(1)
    expect(card(/Playlists/)).toHaveAttribute('aria-selected', 'true')
    hw.press()
    expect(nav.push).toHaveBeenCalledWith({ id: 'playlists' })
  })

  it('lets the knob through while an overlay is up', () => {
    const { onResume } = setup({}, { busy: true })
    hw.press()
    expect(onResume).not.toHaveBeenCalled()
  })
})

describe('HomePage clock', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the time in the header, turning over on the minute without re-rendering the page', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 14, 21, 4, 30))
    setup()
    const clock = screen.getByTestId('home-clock')
    expect(clock).toHaveTextContent('9:04PM')
    const renders = vi.mocked(useKnobNav).mock.calls.length

    act(() => vi.advanceTimersByTime(29_000))
    expect(clock).toHaveTextContent('9:04PM')
    act(() => vi.advanceTimersByTime(1_000))
    expect(clock).toHaveTextContent('9:05PM')
    expect(vi.mocked(useKnobNav).mock.calls.length).toBe(renders)
  })
})
