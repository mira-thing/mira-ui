import { API_BASE } from '@/config'

/** Liked Songs, which the daemon lists first among the playlists. */
export const LIKED_SONGS_URI = 'spotify:collection:tracks'

export interface LibraryPlaylist {
  uri: string
  name: string
  owner: string
  image_url: string
  /** null for a regular playlist in the list; the daemon has no count without fetching it */
  track_count: number | null
}

export interface LibraryTrack {
  uri: string
  uid?: string
  name: string
  artist: string
  album: string
  image_url: string
  duration_ms: number
  playable: boolean
}

export interface LibraryPage<T> {
  items: T[]
  total: number
  next_offset: number | null
}

export interface PlaylistPage extends LibraryPage<LibraryTrack> {
  playlist: LibraryPlaylist
}

/** A failed library request; `status` is 0 when the request never got a response. */
export class LibraryError extends Error {
  readonly status: number
  constructor(path: string, status: number) {
    super(`${path}: ${status}`)
    this.name = 'LibraryError'
    this.status = status
  }
}

async function getJson<T>(path: string, params: URLSearchParams): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}?${params}`, { cache: 'no-store' })
  } catch {
    throw new LibraryError(path, 0)
  }
  if (!res.ok) throw new LibraryError(path, res.status)
  return (await res.json()) as T
}

function paging(offset: number, limit: number): URLSearchParams {
  return new URLSearchParams({ offset: String(offset), limit: String(limit) })
}

/** One page of the user's playlists, Liked Songs first on the first page. */
export async function fetchPlaylists(
  offset: number,
  limit: number,
): Promise<LibraryPage<LibraryPlaylist>> {
  return getJson('/library/playlists', paging(offset, limit))
}

/** One page of a playlist's tracks, with the playlist itself. */
export async function fetchPlaylist(
  uri: string,
  offset: number,
  limit: number,
): Promise<PlaylistPage> {
  const params = paging(offset, limit)
  params.set('uri', uri)
  const body = await getJson<
    LibraryPlaylist & { tracks: LibraryTrack[]; total: number; next_offset: number | null }
  >('/library/playlist', params)
  const { tracks, total, next_offset, ...playlist } = body
  return { playlist, items: tracks, total, next_offset }
}
