import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { libraryHandlers, makePlaylists, makeTracks } from '@/__tests__/fixtures/library'
import { server } from '@/__tests__/msw-server'
import { fetchPlaylist, fetchPlaylists, LibraryError, LIKED_SONGS_URI } from '../library'

describe('library api', () => {
  it('pages the playlists with offset and limit', async () => {
    const requests = { playlists: [] as string[], playlist: [] as string[] }
    server.use(...libraryHandlers(makePlaylists(5), {}, requests))
    const first = await fetchPlaylists(0, 3)
    expect(first.items.map((p) => p.name)).toEqual(['Liked Songs', 'Playlist 1', 'Playlist 2'])
    expect(first).toMatchObject({ total: 5, next_offset: 3 })
    expect(first.items[0].uri).toBe(LIKED_SONGS_URI)
    expect(first.items[1].track_count).toBeNull()
    const last = await fetchPlaylists(3, 3)
    expect(last.items).toHaveLength(2)
    expect(last.next_offset).toBeNull()
    expect(requests.playlists).toEqual(['?offset=0&limit=3', '?offset=3&limit=3'])
  })

  it('splits a playlist page into the playlist and its tracks', async () => {
    const [, mix] = makePlaylists(2)
    server.use(...libraryHandlers([mix], { [mix.uri]: makeTracks(3) }))
    const res = await fetchPlaylist(mix.uri, 0, 50)
    expect(res.playlist).toEqual({ ...mix, track_count: 3 })
    expect(res.items.map((t) => t.name)).toEqual(['Track 0', 'Track 1', 'Track 2'])
    expect(res).toMatchObject({ total: 3, next_offset: null })
  })

  it.each([400, 404, 429, 500])('throws a LibraryError carrying a %i', async (status) => {
    server.use(http.get('*/library/playlists', () => new HttpResponse(null, { status })))
    const err = await fetchPlaylists(0, 50).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LibraryError)
    expect((err as LibraryError).status).toBe(status)
  })

  it('reports a network failure as status 0', async () => {
    server.use(http.get('*/library/playlists', () => HttpResponse.error()))
    const err = await fetchPlaylists(0, 50).catch((e: unknown) => e)
    expect((err as LibraryError).status).toBe(0)
  })
})
