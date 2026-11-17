import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, withRouter } from '@/__tests__/hardware'
import { libraryHandlers, makePlaylists, type LibraryRequests } from '@/__tests__/fixtures/library'
import { server } from '@/__tests__/msw-server'
import { NavigationContext, type Navigation } from '@/app/navigation'
import type { Overlays } from '@/hooks/useOverlays'
import { OverlayContext } from '@/overlays/overlayContext'
import { clearLibraryCache, PLAYLISTS_KEY, playlistsCache } from '../libraryCache'
import { PlaylistsPage } from '../PlaylistsPage'

function setup({ restoreKey, busy = false }: { restoreKey?: string; busy?: boolean } = {}) {
  const nav: Navigation = {
    push: vi.fn(),
    pop: vi.fn(() => true),
    reset: vi.fn(),
    setFocusKey: vi.fn(),
  }
  const overlays = { open: vi.fn(), busy } as unknown as Overlays
  const wrapper = ({ children }: { children: ReactNode }) =>
    withRouter({
      children: (
        <OverlayContext.Provider value={overlays}>
          <NavigationContext.Provider value={nav}>{children}</NavigationContext.Provider>
        </OverlayContext.Provider>
      ),
    })
  const view = render(<PlaylistsPage restoreKey={restoreKey} />, { wrapper })
  return { nav, ...view }
}

function serve(n: number) {
  const requests: LibraryRequests = { playlists: [], playlist: [] }
  server.use(...libraryHandlers(makePlaylists(n), {}, requests))
  return requests
}

// only Date is faked, so the knob's step filter sees time pass while msw still runs
const turn = (n: number) => hw.turnSteps(n, 1, { advance: (ms) => vi.advanceTimersByTime(ms) })

const rows = () => screen.getAllByRole('option')
const focused = () => screen.getByRole('option', { selected: true })

describe('PlaylistsPage', () => {
  beforeEach(() => {
    clearLibraryCache()
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => vi.useRealTimers())

  it('shows a loading state, then the playlists with Liked Songs first', async () => {
    serve(3)
    setup()
    expect(screen.getByRole('status')).toHaveTextContent('Loading playlists...')

    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(rows()[0]).toHaveTextContent('Liked Songs')
    expect(within(rows()[0]).getByRole('img', { name: 'Liked Songs' })).toBeInTheDocument()
    expect(screen.getByText('3 in your library')).toBeInTheDocument()
  })

  it('shows a count only where the daemon has one', async () => {
    serve(2)
    setup()
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(rows()[0]).toHaveTextContent('312 songs')
    expect(rows()[1]).toHaveTextContent('Playlist 1')
    expect(rows()[1]).toHaveTextContent('Owner 1')
    expect(rows()[1]).not.toHaveTextContent(/songs?/)
    expect(within(rows()[1]).getByRole('img', { name: 'Playlist' })).toBeInTheDocument()
  })

  it('pages in the next 50 as the knob nears the end, until there are no more', async () => {
    const requests = serve(120)
    setup()
    await waitFor(() => expect(focused()).toHaveTextContent('Liked Songs'))
    expect(requests.playlists).toEqual(['?offset=0&limit=50'])

    turn(49)
    await waitFor(() => expect(requests.playlists).toHaveLength(2))
    expect(requests.playlists[1]).toBe('?offset=50&limit=50')
    await waitFor(() => expect(focused()).toHaveTextContent('Playlist 49'))

    turn(50)
    await waitFor(() =>
      expect(requests.playlists).toEqual([
        '?offset=0&limit=50',
        '?offset=50&limit=50',
        '?offset=100&limit=50',
      ]),
    )
    turn(30)
    await waitFor(() => expect(focused()).toHaveTextContent('Playlist 119'))
    expect(requests.playlists).toHaveLength(3)
  })

  it('says so when the library is empty', async () => {
    server.use(
      http.get('*/library/playlists', () =>
        HttpResponse.json({ items: [], total: 0, next_offset: null }),
      ),
    )
    setup()
    expect(await screen.findByText('No playlists yet')).toBeInTheDocument()
  })

  it('offers a retry when the first page fails, by knob or by tap', async () => {
    let fail = 2
    server.use(
      http.get('*/library/playlists', () =>
        fail-- > 0
          ? new HttpResponse(null, { status: 429 })
          : HttpResponse.json({ items: makePlaylists(2), total: 2, next_offset: null }),
      ),
    )
    setup()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load your playlists")
    expect(alert).toHaveTextContent('Spotify is busy')

    hw.press()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps what loaded when a later page fails, and retries it from the last row', async () => {
    const all = makePlaylists(60)
    let failNext = true
    server.use(
      http.get('*/library/playlists', ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'))
        if (offset === 0)
          return HttpResponse.json({ items: all.slice(0, 50), total: 60, next_offset: 50 })
        if (failNext) {
          failNext = false
          return new HttpResponse(null, { status: 500 })
        }
        return HttpResponse.json({ items: all.slice(50), total: 60, next_offset: null })
      }),
    )
    setup()
    await waitFor(() => expect(focused()).toHaveTextContent('Liked Songs'))
    turn(50)
    await waitFor(() => expect(focused()).toHaveTextContent("Couldn't load more"))

    hw.press()
    await waitFor(() => expect(focused()).toHaveTextContent('Playlist 50'))
    expect(screen.queryByText("Couldn't load more")).not.toBeInTheDocument()
  })

  it('opens a playlist by knob press with its uri and name, saving the focus first', async () => {
    serve(3)
    const { nav } = setup()
    await waitFor(() => expect(rows()).toHaveLength(3))
    turn(1)
    hw.press()
    const uri = makePlaylists(2)[1].uri
    expect(nav.setFocusKey).toHaveBeenLastCalledWith(uri)
    expect(nav.push).toHaveBeenCalledWith({ id: 'playlist', params: { uri, name: 'Playlist 1' } })
  })

  it('opens a playlist by tap', async () => {
    serve(3)
    const { nav } = setup()
    await waitFor(() => expect(rows()).toHaveLength(3))
    fireEvent.click(within(rows()[2]).getByRole('button'))
    const uri = makePlaylists(3)[2].uri
    expect(nav.setFocusKey).toHaveBeenCalledWith(uri)
    expect(nav.push).toHaveBeenCalledWith({ id: 'playlist', params: { uri, name: 'Playlist 2' } })
  })

  it('comes back from the cache, focused on the row it left, without fetching again', async () => {
    const requests = serve(80)
    const first = setup()
    await waitFor(() => expect(focused()).toHaveTextContent('Liked Songs'))
    turn(45)
    // the knob stops on the loading row until the next page is in
    await waitFor(() => expect(playlistsCache.get(PLAYLISTS_KEY).items).toHaveLength(80))
    turn(15)
    await waitFor(() => expect(focused()).toHaveTextContent('Playlist 60'))
    const key = makePlaylists(61)[60].uri
    expect(first.nav.setFocusKey).toHaveBeenLastCalledWith(key)
    first.unmount()

    setup({ restoreKey: key })
    expect(focused()).toHaveTextContent('Playlist 60')
    expect(requests.playlists).toHaveLength(2)
  })

  it('leaves the knob to a sheet over it', async () => {
    serve(3)
    const { nav } = setup({ busy: true })
    await waitFor(() => expect(rows()).toHaveLength(3))
    turn(1)
    hw.press()
    expect(nav.push).not.toHaveBeenCalled()
  })
})
