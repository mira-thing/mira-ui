import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import App from '../App'
import { server } from './msw-server'
import { baseWire } from './fixtures/observer'

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
})
