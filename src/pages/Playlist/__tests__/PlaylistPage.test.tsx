import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hw, withRouter } from '@/__tests__/hardware'
import {
  libraryHandlers,
  likedSongs,
  makePlaylists,
  makeTracks,
  playerHandlers,
  type LibraryRequests,
  type PlayerRequests,
} from '@/__tests__/fixtures/library'
import { server } from '@/__tests__/msw-server'
import type { LibraryPlaylist } from '@/api/library'
import { NavigationContext, type Navigation } from '@/app/navigation'
import { createRouteBack, RouteBackContext } from '@/app/routeBack'
import type { Overlays } from '@/hooks/useOverlays'
import { NotifyContext } from '@/notify/notifyContext'
import { OverlayContext } from '@/overlays/overlayContext'
import { clearLibraryCache } from '@/pages/Playlists/libraryCache'
import { PlaylistPage } from '../PlaylistPage'

const mix: LibraryPlaylist = makePlaylists(2)[1]

interface Setup {
  playlist?: LibraryPlaylist
  restoreKey?: string
  deviceActive?: boolean
}

function setup({ playlist = mix, restoreKey, deviceActive = true }: Setup = {}) {
  const nav: Navigation = {
    push: vi.fn(),
    pop: vi.fn(() => true),
    reset: vi.fn(),
    setFocusKey: vi.fn(),
  }
  const open = vi.fn()
  const notify = vi.fn()
  const routeBack = createRouteBack()
  let setActive: (on: boolean) => void = () => {}
  let setPicker: (on: boolean) => void = () => {}
  function Harness() {
    const [active, set] = useState(deviceActive)
    const [picker, setPickerOpen] = useState(false)
    setActive = set
    setPicker = setPickerOpen
    const overlays = {
      open: (id: string) => {
        open(id)
        if (id === 'deviceMenu') setPickerOpen(true)
      },
      isOpen: (id: string) => id === 'deviceMenu' && picker,
      busy: false,
    } as unknown as Overlays
    return (
      <OverlayContext.Provider value={overlays}>
        <PlaylistPage
          uri={playlist.uri}
          name={playlist.name}
          restoreKey={restoreKey}
          deviceActive={active}
        />
      </OverlayContext.Provider>
    )
  }
  const wrapper = ({ children }: { children: ReactNode }) =>
    withRouter({
      children: (
        <NotifyContext.Provider value={notify}>
          <RouteBackContext.Provider value={routeBack}>
            <NavigationContext.Provider value={nav}>{children}</NavigationContext.Provider>
          </RouteBackContext.Provider>
        </NotifyContext.Provider>
      ),
    })
  render(<Harness />, { wrapper })
  return {
    nav,
    overlays: { open },
    notify,
    back: () => {
      let took = false
      act(() => {
        took = routeBack.run()
      })
      return took
    },
    setDeviceActive: (on: boolean) => act(() => setActive(on)),
    closePicker: () => act(() => setPicker(false)),
  }
}

function serve(tracks = makeTracks(5), playlist: LibraryPlaylist = mix) {
  const library: LibraryRequests = { playlists: [], playlist: [] }
  const player: PlayerRequests = { play: [], queue: [] }
  server.use(
    ...libraryHandlers([playlist], { [playlist.uri]: tracks }, library),
    ...playerHandlers(player),
  )
  return { library, player }
}

// only Date is faked, so the knob's step filter sees time pass while msw still runs
const turn = (n: number, dir: 1 | -1 = 1) =>
  hw.turnSteps(n, dir, { advance: (ms) => vi.advanceTimersByTime(ms) })

const trackRow = (name: string) => screen.getByRole('option', { name: new RegExp(name) })
const tracksLoaded = () => waitFor(() => expect(trackRow('Track 0')).toBeInTheDocument())
const button = (name: string) => screen.getByRole('button', { name })
const sheet = () => screen.queryByRole('dialog')

describe('PlaylistPage', () => {
  beforeEach(() => {
    clearLibraryCache()
    vi.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => vi.useRealTimers())

  describe('header', () => {
    it('shows the name it was opened with before the playlist loads, then its details', async () => {
      serve()
      setup()
      expect(screen.getByRole('heading', { name: 'Playlist 1' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Loading tracks...')
      expect(screen.getByRole('img', { name: 'Playlist' })).toBeInTheDocument()

      await waitFor(() => expect(screen.getByText('Owner 1 · 5 songs')).toBeInTheDocument())
      expect(button('Play')).toHaveAttribute('aria-selected', 'true')
      expect(button('Shuffle')).toBeInTheDocument()
    })

    it('draws Liked Songs with its heart and count, and no owner', async () => {
      serve(makeTracks(2), likedSongs)
      setup({ playlist: likedSongs })
      await waitFor(() => expect(screen.getByText('2 songs')).toBeInTheDocument())
      expect(screen.getByRole('img', { name: 'Liked Songs' })).toBeInTheDocument()
    })
  })

  describe('tracks', () => {
    it('lists each track with its artist and length', async () => {
      serve()
      setup()
      await tracksLoaded()
      expect(trackRow('Track 0')).toHaveTextContent('Artist 0')
      expect(trackRow('Track 0')).toHaveTextContent('3:03')
    })

    it('pages in more tracks as the knob nears the end', async () => {
      const { library } = serve(makeTracks(70))
      setup()
      await tracksLoaded()
      expect(library.playlist).toHaveLength(1)
      turn(48)
      await waitFor(() => expect(library.playlist).toHaveLength(2))
      expect(new URLSearchParams(library.playlist[1]).get('offset')).toBe('50')
    })

    it('dims an unplayable track, which takes focus but opens nothing by knob or tap', async () => {
      serve(makeTracks(3, [1]))
      setup()
      await tracksLoaded()
      expect(trackRow('Track 1')).toHaveAttribute('aria-disabled', 'true')
      expect(trackRow('Track 1').firstElementChild).toHaveClass('disabled')

      turn(3)
      expect(trackRow('Track 1')).toHaveAttribute('aria-selected', 'true')
      hw.press()
      expect(sheet()).not.toBeInTheDocument()

      fireEvent.click(within(trackRow('Track 1')).getByRole('button'))
      expect(sheet()).not.toBeInTheDocument()
    })

    it('offers a retry when the tracks fail to load', async () => {
      let fail = true
      server.use(
        http.get('*/library/playlist', () => {
          if (fail) {
            fail = false
            return new HttpResponse(null, { status: 404 })
          }
          return HttpResponse.json({
            ...mix,
            track_count: 1,
            tracks: makeTracks(1),
            total: 1,
            next_offset: null,
          })
        }),
      )
      setup()
      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load this playlist")
      turn(2)
      expect(button('Try again')).toHaveAttribute('aria-selected', 'true')
      hw.press()
      await tracksLoaded()
    })

    it('restores focus to the track it left', async () => {
      serve()
      setup({ restoreKey: 'u:uid3' })
      await tracksLoaded()
      expect(trackRow('Track 3')).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('the track sheet', () => {
    it('opens on a knob press and adds to the queue by knob', async () => {
      const { player } = serve()
      const { nav, notify } = setup()
      await tracksLoaded()
      turn(3)
      hw.press()
      expect(nav.setFocusKey).toHaveBeenLastCalledWith('u:uid1')
      expect(sheet()).toHaveAccessibleName('Track 1')
      expect(button('Play from here')).toHaveClass('focused')

      // the list underneath stays put while the sheet has the knob
      turn(1)
      expect(trackRow('Track 1')).toHaveAttribute('aria-selected', 'true')
      expect(button('Add to queue')).toHaveClass('focused')
      hw.press()

      expect(sheet()).not.toBeInTheDocument()
      await waitFor(() => expect(player.queue).toEqual([{ uri: 'spotify:track:t1' }]))
      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith('Added Track 1 to the queue', {
          variant: 'success',
          icon: 'queue',
        }),
      )
      expect(player.play).toEqual([])
    })

    it('opens on a tap and plays from the track by tap, then shows the player', async () => {
      const { player } = serve()
      const { nav } = setup()
      await tracksLoaded()
      fireEvent.click(within(trackRow('Track 2')).getByRole('button'))
      expect(sheet()).toHaveAccessibleName('Track 2')

      fireEvent.click(button('Play from here'))
      await waitFor(() =>
        expect(player.play).toEqual([{ uri: mix.uri, skip_to_uri: 'spotify:track:t2' }]),
      )
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith({ id: 'player' }))
    })

    it('starts on Play from here every time it opens', async () => {
      serve()
      setup()
      await tracksLoaded()
      fireEvent.click(within(trackRow('Track 0')).getByRole('button'))
      turn(1)
      expect(button('Add to queue')).toHaveClass('focused')
      fireEvent.click(sheet()!.parentElement!)
      fireEvent.click(within(trackRow('Track 0')).getByRole('button'))
      expect(button('Play from here')).toHaveClass('focused')
    })

    it('closes on Back without leaving the page, and on a tap outside it', async () => {
      serve()
      const { back, nav } = setup()
      await tracksLoaded()
      fireEvent.click(within(trackRow('Track 0')).getByRole('button'))
      expect(sheet()).toBeInTheDocument()

      expect(back()).toBe(true)
      expect(sheet()).not.toBeInTheDocument()
      expect(nav.pop).not.toHaveBeenCalled()
      // with the sheet shut, Back is the page stack's again
      expect(back()).toBe(false)

      fireEvent.click(within(trackRow('Track 0')).getByRole('button'))
      fireEvent.click(sheet()!.parentElement!)
      expect(sheet()).not.toBeInTheDocument()
    })

    it('says so when the queue refuses the track', async () => {
      server.use(
        ...libraryHandlers([mix], { [mix.uri]: makeTracks(1) }),
        ...playerHandlers(undefined, { queueStatus: 500 }),
      )
      const { notify } = setup()
      await tracksLoaded()
      fireEvent.click(within(trackRow('Track 0')).getByRole('button'))
      fireEvent.click(button('Add to queue'))
      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith("Couldn't add to the queue", { variant: 'error' }),
      )
    })
  })

  describe('playing', () => {
    it('plays in order or shuffled from the header, by knob and by tap', async () => {
      const { player } = serve()
      const { nav } = setup()
      await tracksLoaded()
      hw.press()
      await waitFor(() => expect(player.play).toEqual([{ uri: mix.uri, shuffle: false }]))
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith({ id: 'player' }))

      fireEvent.click(button('Shuffle'))
      await waitFor(() => expect(player.play[1]).toEqual({ uri: mix.uri, shuffle: true }))
    })

    it('asks for a device when none is active, then plays once one is', async () => {
      const { player } = serve()
      const { nav, overlays, notify, setDeviceActive } = setup({ deviceActive: false })
      await tracksLoaded()
      fireEvent.click(within(trackRow('Track 4')).getByRole('button'))
      fireEvent.click(button('Play from here'))

      expect(overlays.open).toHaveBeenCalledWith('deviceMenu')
      expect(notify).toHaveBeenCalledWith('Pick a device to play on', {
        variant: 'info',
        icon: 'device',
      })
      expect(player.play).toEqual([])

      setDeviceActive(true)
      await waitFor(() =>
        expect(player.play).toEqual([{ uri: mix.uri, skip_to_uri: 'spotify:track:t4' }]),
      )
      await waitFor(() => expect(nav.push).toHaveBeenCalledWith({ id: 'player' }))
    })

    it('plays when a pick closes the picker and its device comes up just after', async () => {
      const { player } = serve()
      const { setDeviceActive, closePicker } = setup({ deviceActive: false })
      await tracksLoaded()
      hw.press()
      closePicker()
      act(() => vi.advanceTimersByTime(3_000))
      setDeviceActive(true)
      await waitFor(() => expect(player.play).toEqual([{ uri: mix.uri, shuffle: false }]))
    })

    it('drops the play when the picker closes and no device comes up soon after', async () => {
      const { player } = serve()
      const { setDeviceActive, closePicker } = setup({ deviceActive: false })
      await tracksLoaded()
      hw.press()
      act(() => vi.advanceTimersByTime(120_000))
      closePicker()
      act(() => vi.advanceTimersByTime(11_000))
      setDeviceActive(true)
      await act(() => Promise.resolve())
      expect(player.play).toEqual([])
    })

    it('says so when the device refuses, and stays on the page', async () => {
      server.use(
        ...libraryHandlers([mix], { [mix.uri]: makeTracks(1) }),
        ...playerHandlers(undefined, { playStatus: 500 }),
      )
      const { nav, notify } = setup()
      await tracksLoaded()
      hw.press()
      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith("Couldn't start playback", { variant: 'error' }),
      )
      expect(nav.push).not.toHaveBeenCalled()
    })
  })
})
