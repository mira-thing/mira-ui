import type { QueueTrack } from '@/api/types'
import { isNarrationUri } from '@/hooks/useDJNarration'

// the daemon sends at most this many of the tracks after the current one
const UP_NEXT_CAP = 10

export interface UpNextItem {
  /** URI plus which repeat of it this is: stable as the queue advances */
  key: string
  track: QueueTrack
}

// DJ narration rides in the queue but is not a track to show
const isTrack = (t: QueueTrack) => !isNarrationUri(t.uri)

/** The rows of the Up next list. */
export function upNextItems(tracks: readonly QueueTrack[]): UpNextItem[] {
  const seen = new Map<string, number>()
  return tracks.filter(isTrack).map((track) => {
    const nth = seen.get(track.uri) ?? 0
    seen.set(track.uri, nth + 1)
    return { key: `${track.uri}#${nth}`, track }
  })
}

/** How much is up next, as Home's card and the queue's header say it. */
export function upNextSummary(tracks: readonly QueueTrack[]): string {
  const count = tracks.filter(isTrack).length
  if (count === 0) return 'Nothing queued'
  // a full page from the daemon may have more behind it
  if (tracks.length >= UP_NEXT_CAP) return `${count}+ up next`
  return `${count} up next`
}

export const upNextKey = (item: UpNextItem) => item.key
