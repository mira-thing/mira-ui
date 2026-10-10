import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import App from '../App'
import { server } from './msw-server'
import { baseWire } from './fixtures/observer'
import type * as ColorExtract from '@/hooks/useColorExtract'

const busState = vi.hoisted(() => ({
  listeners: [] as Array<(evt: { type: string; data: unknown }) => void>,
}))

const art = vi.hoisted(() => ({
  themed: [] as Array<string | undefined>,
  loads: new Map<string, (image: HTMLImageElement | null) => void>(),
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

// the theme samples through useArtworkColors; the scene and the art wait on loadArtwork
vi.mock('@/hooks/useColorExtract', async (importOriginal) => ({
  ...(await importOriginal<typeof ColorExtract>()),
  useArtworkColors: (url: string | undefined) => {
    art.themed.push(url)
    return { palette: null, pending: false }
  },
  loadArtwork: (url: string | undefined) =>
    url === 'https://y'
      ? new Promise((resolve) => art.loads.set(url, resolve))
      : Promise.resolve(null),
}))

function pushEvent(type: string, data: unknown) {
  act(() => {
    for (const fn of [...busState.listeners]) fn({ type, data })
  })
}

describe('App theme', () => {
  it('keeps the old album theme until the next cover has loaded', async () => {
    server.use(
      http.get('*/connect/devices', () => HttpResponse.json([])),
      http.get('*/player/saved', () => HttpResponse.json({ saved: false })),
      http.get('*/lyrics/*', () => HttpResponse.json({ lines: [] })),
    )
    render(<App />)
    await waitFor(() => expect(screen.getByText('Nothing playing')).toBeInTheDocument())

    pushEvent('observer_track_changed', baseWire)
    await waitFor(() => expect(art.themed.at(-1)).toBe('https://x'))

    pushEvent('observer_track_changed', {
      ...baseWire,
      TrackUri: 'spotify:track:def',
      TrackName: 'Next',
      TrackImageUrl: 'https://y',
    })
    await waitFor(() => expect(art.loads.has('https://y')).toBe(true))
    expect(art.themed.at(-1)).toBe('https://x')

    await act(async () => art.loads.get('https://y')!(null))
    await waitFor(() => expect(art.themed.at(-1)).toBe('https://y'))
  })
})
