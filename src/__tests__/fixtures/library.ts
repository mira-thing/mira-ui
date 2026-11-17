import { http, HttpResponse } from 'msw'
import { LIKED_SONGS_URI, type LibraryPlaylist, type LibraryTrack } from '@/api/library'

export const likedSongs: LibraryPlaylist = {
  uri: LIKED_SONGS_URI,
  name: 'Liked Songs',
  owner: '',
  image_url: '',
  track_count: 312,
}

/** Liked Songs then `n - 1` regular playlists, whose counts the list never has. */
export function makePlaylists(n: number): LibraryPlaylist[] {
  const out = [likedSongs]
  for (let i = 1; i < n; i++) {
    out.push({
      uri: `spotify:playlist:${String(i).padStart(22, '0')}`,
      name: `Playlist ${i}`,
      owner: `Owner ${i}`,
      image_url: '',
      track_count: null,
    })
  }
  return out.slice(0, n)
}

export function makeTracks(n: number, unplayable: readonly number[] = []): LibraryTrack[] {
  return Array.from({ length: n }, (_, i) => ({
    uri: `spotify:track:t${i}`,
    uid: `uid${i}`,
    name: `Track ${i}`,
    artist: `Artist ${i}`,
    album: `Album ${i}`,
    image_url: '',
    duration_ms: 183_000 + i * 1000,
    playable: !unplayable.includes(i),
  }))
}

function page<T>(all: readonly T[], url: URL) {
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const limit = Number(url.searchParams.get('limit') ?? 50)
  const items = all.slice(offset, offset + limit)
  const next = offset + items.length
  return { items, total: all.length, next_offset: next < all.length ? next : null }
}

export interface LibraryRequests {
  playlists: string[]
  playlist: string[]
}

/**
 * The daemon's /library routes over in-memory data, paging as the daemon does. `requests`
 * records each query string, so a test can count fetches.
 */
export function libraryHandlers(
  playlists: readonly LibraryPlaylist[],
  tracks: Record<string, readonly LibraryTrack[]> = {},
  requests: LibraryRequests = { playlists: [], playlist: [] },
) {
  return [
    http.get('*/library/playlists', ({ request }) => {
      const url = new URL(request.url)
      requests.playlists.push(url.search)
      return HttpResponse.json(page(playlists, url))
    }),
    http.get('*/library/playlist', ({ request }) => {
      const url = new URL(request.url)
      requests.playlist.push(url.search)
      const uri = url.searchParams.get('uri') ?? ''
      const meta = playlists.find((p) => p.uri === uri)
      const all = tracks[uri]
      if (!meta || !all) return new HttpResponse(null, { status: 404 })
      const { items, total, next_offset } = page(all, url)
      return HttpResponse.json({
        ...meta,
        track_count: all.length,
        tracks: items,
        total,
        next_offset,
      })
    }),
  ]
}

export interface PlayerRequests {
  play: unknown[]
  queue: unknown[]
}

/** `/player/play` and `/player/add_to_queue`, recording bodies; `status` fails them. */
export function playerHandlers(
  requests: PlayerRequests = { play: [], queue: [] },
  { playStatus = 200, queueStatus = 200 } = {},
) {
  return [
    http.post('*/player/play', async ({ request }) => {
      requests.play.push(await request.json())
      return playStatus === 200
        ? HttpResponse.json({})
        : new HttpResponse(null, { status: playStatus })
    }),
    http.post('*/player/add_to_queue', async ({ request }) => {
      requests.queue.push(await request.json())
      return queueStatus === 200
        ? HttpResponse.json({})
        : new HttpResponse(null, { status: queueStatus })
    }),
  ]
}
