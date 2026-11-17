import {
  fetchPlaylist,
  fetchPlaylists,
  LibraryError,
  type LibraryPlaylist,
  type LibraryTrack,
} from '@/api/library'
import { createPagedCache } from '@/hooks/pagedCache'

const PAGE = 50
/** the playlists list's one key in `playlistsCache` */
export const PLAYLISTS_KEY = 'library'

export const playlistsCache = createPagedCache<LibraryPlaylist>({
  fetchPage: (_key, offset, limit) => fetchPlaylists(offset, limit),
  limit: PAGE,
  dedupeBy: (p) => p.uri,
})

/** Keyed by playlist uri; a handful, so Back from the player finds the tracks it came from. */
export const playlistCache = createPagedCache<LibraryTrack, LibraryPlaylist>({
  fetchPage: async (uri, offset, limit) => {
    const { playlist, ...page } = await fetchPlaylist(uri, offset, limit)
    return { ...page, meta: playlist }
  },
  limit: PAGE,
  dedupeBy: (t) => t.uid,
  maxEntries: 8,
})

/** Drops everything cached, for tests. */
export function clearLibraryCache(): void {
  playlistsCache.clear()
  playlistCache.clear()
}

/** What to tell the user about a failed library request. */
export function libraryErrorText(err: unknown): string {
  const status = err instanceof LibraryError ? err.status : -1
  switch (status) {
    case 0:
      return "Can't reach the player service"
    case 404:
      return 'Not found'
    case 429:
      return 'Spotify is busy. Try again in a moment'
    case 503:
      return 'Spotify is still starting up'
    default:
      return 'Something went wrong'
  }
}

export function songCount(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'song' : 'songs'}`
}
