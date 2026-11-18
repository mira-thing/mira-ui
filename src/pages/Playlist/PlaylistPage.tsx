import { useMemo, useState } from 'react'
import { LIKED_SONGS_URI, type LibraryTrack } from '@/api/library'
import { useNavigation } from '@/app/navigation'
import { usePagedList } from '@/hooks/pagedCache'
import { useQueueActions } from '@/hooks/useQueueActions'
import { useKnobNav } from '@/input/useKnobNav'
import { useOverlayState } from '@/overlays/overlayContext'
import { playlistCache, songCount } from '@/pages/Playlists/libraryCache'
import { LibraryBody, MORE_KEY, MoreRow, RETRY_KEY } from '@/pages/Playlists/LibraryStates'
import libraryStyles from '@/pages/Playlists/LibraryStates.module.scss'
import { Artwork } from '@/ui/Artwork'
import { Button } from '@/ui/Button'
import { EmptyState } from '@/ui/EmptyState'
import { KnobList, ListRow, type ListSection } from '@/ui/List'
import { Page, PageHeader } from '@/ui/Page'
import { formatTime } from '@/utils/time'
import { TrackSheet } from './TrackSheet'
import { useLibraryPlay } from './useLibraryPlay'
import styles from './PlaylistPage.module.scss'

const ROW_PX = 60
const ROW_ART_PX = 40
const HEADER_ART_PX = 64

type Row =
  | { kind: 'track'; key: string; track: LibraryTrack }
  | { kind: 'more'; key: string; failed: boolean }

const rowKey = (row: Row) => row.key

export interface PlaylistPageProps {
  uri: string
  /** from the list, so the header has a title before the playlist loads */
  name: string
  restoreKey?: string
  /** a device is playing, so a play has somewhere to go */
  deviceActive: boolean
}

/** One playlist: its header with Play and Shuffle, then its tracks, each opening a small sheet. */
export function PlaylistPage({ uri, name, restoreKey, deviceActive }: PlaylistPageProps) {
  const nav = useNavigation()
  const overlays = useOverlayState()
  const queue = useQueueActions()
  const play = useLibraryPlay(deviceActive)
  const list = usePagedList(playlistCache, uri)
  const { items, loaded, error, meta, failedFirst, hasTail } = list
  const [sheetTrack, setSheetTrack] = useState<LibraryTrack | null>(null)

  const rows = useMemo<Row[]>(() => {
    // a playlist can hold the same track twice; uid tells the copies apart
    const out: Row[] = items.map((track, i) => ({
      kind: 'track',
      key: track.uid ? `u:${track.uid}` : `i:${i}`,
      track,
    }))
    if (hasTail) out.push({ kind: 'more', key: MORE_KEY, failed: !!error })
    return out
  }, [items, hasTail, error])
  const sections = useMemo<ListSection<Row>[]>(() => [{ key: 'tracks', items: rows }], [rows])
  const keys = useMemo(() => {
    if (failedFirst) return ['play', 'shuffle', RETRY_KEY]
    // empty until the first page settles, so a restored focus isn't spent on the header buttons
    if (!loaded) return []
    return ['play', 'shuffle', ...rows.map(rowKey)]
  }, [failedFirst, loaded, rows])
  const tracksByKey = useMemo(() => {
    const map = new Map<string, LibraryTrack>()
    for (const row of rows) if (row.kind === 'track') map.set(row.key, row.track)
    return map
  }, [rows])

  const select = (key: string) => {
    if (key === 'play' || key === 'shuffle') {
      return play({ uri, shuffle: key === 'shuffle' })
    }
    if (key === RETRY_KEY || key === MORE_KEY) return list.retry()
    const track = tracksByKey.get(key)
    if (!track) return
    nav.setFocusKey(key)
    setSheetTrack(track)
  }
  const knob = useKnobNav({
    keys,
    restoreKey,
    onSelect: select,
    disabled: (key) => (key === MORE_KEY && !error) || tracksByKey.get(key)?.playable === false,
    onFocus: nav.setFocusKey,
    enabled: !overlays.busy && sheetTrack === null,
  })

  const closeSheet = () => setSheetTrack(null)
  const playFromHere = (track: LibraryTrack) => {
    closeSheet()
    play({ uri, skipToUri: track.uri })
  }
  const addToQueue = (track: LibraryTrack) => {
    closeSheet()
    void queue.add(track.uri, track.name)
  }

  const title = meta?.name || name
  const count = meta?.track_count ?? null
  const subtitle = [meta?.owner, count !== null ? songCount(count) : null]
    .filter(Boolean)
    .join(' · ')

  const header = (
    <div className={styles.header}>
      <Artwork
        src={meta?.image_url || undefined}
        size={HEADER_ART_PX}
        radius="sm"
        crossfade={false}
        fallback={uri === LIKED_SONGS_URI ? 'liked' : 'playlist'}
      />
      <div className={styles.headerText}>
        <PageHeader
          title={title}
          subtitle={subtitle || undefined}
          trailing={
            <div className={styles.actions}>
              <Button variant="primary" icon="play" {...knob.itemProps('play')}>
                Play
              </Button>
              <Button icon="shuffle" {...knob.itemProps('shuffle')}>
                Shuffle
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )

  const body = (
    <LibraryBody
      list={list}
      loadingLabel="Loading tracks..."
      errorTitle="Couldn't load this playlist"
      retry={knob.itemProps(RETRY_KEY)}
    >
      <KnobList<Row, string>
        sections={sections}
        keyOf={rowKey}
        nav={knob}
        rowHeight={ROW_PX}
        className={libraryStyles.listInset}
        onEndReached={list.loadMore}
        renderRow={(row, { focused, disabled }) =>
          row.kind === 'more' ? (
            <MoreRow failed={row.failed} focused={focused} />
          ) : (
            <TrackRow track={row.track} focused={focused} disabled={disabled} />
          )
        }
        empty={<EmptyState size="page" icon="playlist" title="This playlist is empty" />}
      />
    </LibraryBody>
  )

  return (
    <>
      <Page header={header}>{body}</Page>
      <TrackSheet
        track={sheetTrack}
        onClose={closeSheet}
        onPlayFromHere={playFromHere}
        onAddToQueue={addToQueue}
      />
    </>
  )
}

function TrackRow({
  track,
  focused,
  disabled,
}: {
  track: LibraryTrack
  focused: boolean
  disabled: boolean
}) {
  return (
    <ListRow
      leading={
        <Artwork
          src={track.image_url || undefined}
          size={ROW_ART_PX}
          radius="sm"
          crossfade={false}
        />
      }
      title={track.name}
      subtitle={track.artist}
      value={formatTime(track.duration_ms)}
      focused={focused}
      disabled={disabled}
    />
  )
}
