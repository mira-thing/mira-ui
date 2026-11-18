import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import App from '../App'
import { DevScreenContext, type DevForcedScreen } from '@/dev/devContext'
import { server } from './msw-server'
import { activeStatus, baseWire } from './fixtures/observer'
import { hw } from './hardware'

const busState = vi.hoisted(() => ({
  listeners: [] as Array<(evt: { type: string; data: unknown }) => void>,
}))

vi.mock('@/api/eventBus', () => ({
  subscribeEvents: (fn: (evt: { type: string; data: unknown }) => void) => {
    busState.listeners.push(fn)
    return () => {
      const i = busState.listeners.indexOf(fn)
      if (i >= 0) busState.listeners.splice(i, 1)
    }
  },
  subscribeConnection: (fn: (c: boolean) => void) => {
    fn(true)
    return () => {}
  },
}))

function pushEvent(type: string, data: unknown) {
  act(() => {
    for (const fn of [...busState.listeners]) fn({ type, data })
  })
}

// the page on top: neither covered nor still fading in or out
function currentPage(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.shell > .page:not(.pageInactive):not(.pageCovered)')
}
const homeHeading = () => screen.getByRole('heading', { name: 'Mira' })
const playerView = (container: HTMLElement) => container.querySelector<HTMLElement>('.appPlaying')

function quietPlayerApis() {
  server.use(
    http.get('*/connect/devices', () => HttpResponse.json([])),
    http.get('*/player/saved', () => HttpResponse.json({ saved: false })),
    http.get('*/lyrics/*', () => HttpResponse.json({ lines: [] })),
  )
}

// the screens App can land on are covered by resolveRoute's unit tests; this
// checks the wiring between the live daemon state and those screens
describe('App', () => {
  it('walks from the boot splash to idle to the player', async () => {
    server.use(
      http.get('*/connect/devices', () => HttpResponse.json([])),
      http.get('*/player/saved', () => HttpResponse.json({ saved: false })),
      http.get('*/lyrics/*', () => HttpResponse.json({ lines: [] })),
    )

    render(<App />)

    // nothing resolved yet
    expect(screen.getByText('starting up')).toBeInTheDocument()

    // the daemon answers with no active device
    await waitFor(() => expect(screen.getByText('Nothing playing')).toBeInTheDocument())

    // a device starts playing. both view layers stay mounted so the lyrics
    // toggle can cross-fade, so the track appears in each of them
    pushEvent('observer_track_changed', baseWire)
    await waitFor(() => expect(screen.getAllByText('Song').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Artist').length).toBeGreaterThan(0)
    expect(screen.queryByText('Nothing playing')).not.toBeInTheDocument()
  })

  it('keeps a manual screensaver up without remounting when playback starts', async () => {
    server.use(
      http.get('*/connect/devices', () => HttpResponse.json([])),
      http.get('*/player/saved', () => HttpResponse.json({ saved: false })),
      http.get('*/lyrics/*', () => HttpResponse.json({ lines: [] })),
    )

    render(<App />)
    await waitFor(() => expect(screen.getByText('Nothing playing')).toBeInTheDocument())

    // power double press
    for (let i = 0; i < 2; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }))
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM' }))
      })
    }
    const saver = document.querySelector('.scrim')?.parentElement
    expect(saver).toBeTruthy()

    pushEvent('observer_track_changed', baseWire)
    await waitFor(() => expect(screen.getAllByText('Song').length).toBeGreaterThan(0))
    expect(saver!.isConnected).toBe(true)
    expect(saver!.textContent).toContain('Song')
    expect(document.querySelector('.shell')?.contains(saver!)).toBe(false)
  })

  it('plays from the screensaver on a knob press without closing it', async () => {
    const resume = vi.fn(() => HttpResponse.json({}))
    server.use(
      http.get('*/connect/devices', () => HttpResponse.json([])),
      http.post('*/player/resume_last', resume),
    )

    render(<App />)
    await waitFor(() => expect(screen.getByText('Nothing playing')).toBeInTheDocument())

    for (let i = 0; i < 2; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }))
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM' }))
      })
    }
    const saver = document.querySelector('.scrim')?.parentElement
    expect(saver).toBeTruthy()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })
    await waitFor(() => expect(resume).toHaveBeenCalledTimes(1))
    expect(saver!.isConnected).toBe(true)
  })

  it('holds the boot splash while the daemon reports itself starting up', async () => {
    server.use(
      http.get('*/observer/status', () =>
        HttpResponse.json({ active: false, message: 'starting up' }),
      ),
      http.get('*/connect/devices', () => HttpResponse.json([])),
    )

    render(<App />)

    await waitFor(() => expect(screen.getByText('starting up')).toBeInTheDocument())
    expect(screen.queryByText('Nothing playing')).not.toBeInTheDocument()
  })

  it('shows the auth screen once the daemon hands back a login url', async () => {
    server.use(
      http.get('*/auth/status', () =>
        HttpResponse.json({ required: true, url: 'https://accounts.spotify.com/authorize?x=1' }),
      ),
      http.get('*/connect/devices', () => HttpResponse.json([])),
    )

    render(<App />)

    await waitFor(() => expect(screen.getByText('waiting for sign-in...')).toBeInTheDocument())
    expect(screen.getByText('accounts.spotify.com/authorize?x=1')).toBeInTheDocument()
  })

  describe('home and the page stack', () => {
    async function renderIdle() {
      quietPlayerApis()
      const view = render(<App />)
      await waitFor(() => expect(currentPage(view.container)).toContainElement(homeHeading()))
      return view
    }

    it('shows home when nothing is playing, with resume and the five cards', async () => {
      await renderIdle()

      expect(screen.getByText('Nothing playing')).toBeInTheDocument()
      const cards = screen.getAllByRole('option').map((o) => o.textContent)
      expect(cards).toEqual([
        expect.stringContaining('Resume'),
        expect.stringContaining('Playlists'),
        expect.stringContaining('Queue'),
        expect.stringContaining('Devices'),
        expect.stringContaining('Bluetooth'),
        expect.stringContaining('Settings'),
      ])
    })

    it('resumes the last device from the first card on a knob press', async () => {
      const resume = vi.fn(() => HttpResponse.json({}))
      server.use(http.post('*/player/resume_last', resume))
      await renderIdle()

      hw.press()
      await waitFor(() => expect(resume).toHaveBeenCalledTimes(1))
    })

    it('pushes the player over home when playback starts, in the same shell', async () => {
      const { container } = await renderIdle()
      const shell = container.querySelector('.shell')

      pushEvent('observer_track_changed', baseWire)
      await waitFor(() => expect(currentPage(container)).toContainElement(playerView(container)))
      expect(container.querySelector('.shell')).toBe(shell)
      await waitFor(() =>
        expect(homeHeading().closest('.shell > .page')).toHaveClass('pageCovered'),
      )
    })

    it('lands back on home from the player, which offers the way back', async () => {
      const { container } = await renderIdle()
      pushEvent('observer_track_changed', baseWire)
      await waitFor(() => expect(currentPage(container)).toContainElement(playerView(container)))

      hw.back()
      await waitFor(() => expect(currentPage(container)).toContainElement(homeHeading()))
      expect(screen.getByText('Playing on Pixel 7')).toBeInTheDocument()

      fireEvent.click(screen.getAllByRole('option')[0])
      await waitFor(() => expect(currentPage(container)).toContainElement(playerView(container)))
    })

    it('takes Back on home to the player while a track plays, once per press', async () => {
      const { container } = await renderIdle()
      pushEvent('observer_track_changed', baseWire)
      await waitFor(() => expect(currentPage(container)).toContainElement(playerView(container)))
      hw.back()
      await waitFor(() => expect(currentPage(container)).toContainElement(homeHeading()))

      hw.back()
      await waitFor(() => expect(currentPage(container)).toContainElement(playerView(container)))
      hw.back()
      await waitFor(() => expect(currentPage(container)).toContainElement(homeHeading()))
      // a held button repeats; it must not swap home and the player back and forth
      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', repeat: true, bubbles: true }),
        )
      })
      expect(currentPage(container)).toContainElement(homeHeading())
    })

    it('leaves Back on home alone with nothing playing', async () => {
      const { container } = await renderIdle()
      hw.back()
      expect(currentPage(container)).toContainElement(homeHeading())
      expect(playerView(container)).not.toBeInTheDocument()
    })

    it('leaves a deeper page alone when playback starts', async () => {
      const { container } = await renderIdle()
      fireEvent.click(screen.getByRole('option', { name: /Playlists/ }))
      const playlists = await screen.findByRole('heading', { name: 'Playlists' })
      await waitFor(() => expect(currentPage(container)).toContainElement(playlists))

      pushEvent('observer_track_changed', baseWire)
      await waitFor(() => expect(screen.getByText('Playing on Pixel 7')).toBeInTheDocument())
      expect(currentPage(container)).toContainElement(playlists)
      expect(playerView(container)).not.toBeInTheDocument()

      hw.back()
      await waitFor(() => expect(currentPage(container)).toContainElement(homeHeading()))
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('Song')
    })

    it('lands on home once playback stops under the player', async () => {
      const { container } = await renderIdle()
      pushEvent('observer_track_changed', baseWire)
      await waitFor(() => expect(currentPage(container)).toContainElement(playerView(container)))

      pushEvent('observer_inactive', null)
      await waitFor(() => expect(currentPage(container)).toContainElement(homeHeading()))
      expect(screen.getByText('Nothing playing')).toBeInTheDocument()
      await waitFor(() => expect(playerView(container)).not.toBeInTheDocument())
    })

    it('opens the devices sheet from its card', async () => {
      await renderIdle()

      fireEvent.click(screen.getByRole('option', { name: /Devices/ }))
      expect(
        await screen.findByText('No active devices to select from for playback'),
      ).toBeInTheDocument()
    })
  })

  describe('over a forced dev screen', () => {
    function renderForced(forced: DevForcedScreen) {
      server.use(
        http.get('*/connect/devices', () => HttpResponse.json([])),
        http.get('*/player/saved', () => HttpResponse.json({ saved: false })),
        http.get('*/lyrics/*', () => HttpResponse.json({ lines: [] })),
      )
      const setForced = vi.fn()
      const view = render(
        <DevScreenContext.Provider value={{ forced, setForced }}>
          <App />
        </DevScreenContext.Provider>,
      )
      return { ...view, setForced }
    }

    it('renders the player and every overlay inside the page shell', async () => {
      const { container } = renderForced('settings')

      const dialog = await screen.findByRole('dialog')
      const shell = container.querySelector('.shell')
      expect(shell?.querySelector('.app.appPlaying')).toBeInTheDocument()
      expect(shell?.contains(dialog)).toBe(true)
    })

    // closing only the real flag would leave the forced one holding it open
    it.each(['menu', 'power-menu', 'settings', 'bluetooth-menu'] as const)(
      'drops the override when back closes a forced %s',
      async (forced) => {
        const { setForced } = renderForced(forced)
        await screen.findAllByText('Reka')

        hw.back()
        expect(setForced).toHaveBeenCalledWith('playing-lyrics')
      },
    )

    it('themes the shell idle for a track with no art', async () => {
      const { container } = renderForced('playing-no-art')
      await screen.findAllByText('Reka')

      expect(container.querySelector<HTMLElement>('.shell')?.dataset.theme).toBe('idle')
    })

    it('presents the DJ over a DJ set while it talks', async () => {
      renderForced('dj-narrating')

      expect((await screen.findAllByText('DJ X')).length).toBeGreaterThan(0)
      expect(screen.queryByText('Reka')).not.toBeInTheDocument()
    })

    it('renders a forced ui-kit as a page in the shell, over the covered home', async () => {
      const { container } = renderForced('ui-kit')

      const heading = await screen.findByRole('heading', { name: 'UI kit' })
      const shell = container.querySelector<HTMLElement>('.shell')!
      expect(shell.contains(heading)).toBe(true)
      expect(homeHeading().closest('.shell > .page')).toHaveClass('pageCovered')
    })

    it('leaves a forced ui-kit for the player on back, once its dialog is closed', async () => {
      const { setForced } = renderForced('ui-kit')
      fireEvent.click(await screen.findByRole('button', { name: 'Glass' }))

      hw.back()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(setForced).not.toHaveBeenCalled()

      hw.back()
      expect(setForced).toHaveBeenCalledWith('playing-lyrics')
    })

    it('backs out of a forced player onto home, and no further', async () => {
      const { container, setForced } = renderForced('playing-lyrics')
      await screen.findAllByText('Reka')

      hw.back()
      await waitFor(() => expect(currentPage(container)).toContainElement(homeHeading()))
      hw.back()
      expect(setForced).not.toHaveBeenCalled()
      expect(currentPage(container)).toContainElement(homeHeading())
    })

    it('pops to home from the dev menu, dropping a forced page or screen', async () => {
      quietPlayerApis()
      const setForced = vi.fn()
      const ui = (forced: DevForcedScreen, homeRequests: number) => (
        <DevScreenContext.Provider value={{ forced, setForced, homeRequests }}>
          <App />
        </DevScreenContext.Provider>
      )
      const { container, rerender } = render(ui('playing-lyrics', 0))
      await waitFor(() => expect(currentPage(container)).toContainElement(playerView(container)))

      rerender(ui('playing-lyrics', 1))
      await waitFor(() => expect(currentPage(container)).toContainElement(homeHeading()))
      expect(setForced).not.toHaveBeenCalled()

      rerender(ui('queue', 1))
      await screen.findByRole('heading', { name: 'Queue' })
      rerender(ui('queue', 2))
      expect(setForced).toHaveBeenCalledWith('playing-lyrics')

      setForced.mockClear()
      rerender(ui('auth', 2))
      rerender(ui('auth', 3))
      expect(setForced).toHaveBeenCalledWith('playing-lyrics')
    })

    it('shows home for a forced idle screen, whatever is really playing', async () => {
      server.use(http.get('*/observer/status', () => HttpResponse.json(activeStatus)))
      const { container } = renderForced('idle')

      await waitFor(() => expect(currentPage(container)).toContainElement(homeHeading()))
      expect(screen.getByText('Nothing playing')).toBeInTheDocument()
    })
  })
})
