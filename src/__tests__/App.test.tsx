import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import App from '../App'
import { DevScreenContext, type DevForcedScreen } from '@/dev/devContext'
import { server } from './msw-server'
import { baseWire } from './fixtures/observer'
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

    it('leaves back a no-op on the bare player', async () => {
      const { setForced } = renderForced('playing-lyrics')
      await screen.findAllByText('Reka')

      hw.back()
      expect(setForced).not.toHaveBeenCalled()
      expect(screen.getAllByText('Reka').length).toBeGreaterThan(0)
    })
  })
})
