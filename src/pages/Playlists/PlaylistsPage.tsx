import { useMemo } from 'react'
import { useNavigation } from '@/app/navigation'
import { LIKED_SONGS_URI, type LibraryPlaylist } from '@/api/library'
import { usePagedList } from '@/hooks/pagedCache'
import { useKnobNav } from '@/input/useKnobNav'
import { useOverlayState } from '@/overlays/overlayContext'
import { Artwork } from '@/ui/Artwork'
import { EmptyState } from '@/ui/EmptyState'
import { KnobList, ListRow, type ListSection } from '@/ui/List'
import { Page, PageHeader } from '@/ui/Page'
import { PLAYLISTS_KEY, playlistsCache, songCount } from './libraryCache'
import { LibraryBody, MORE_KEY, MoreRow, RETRY_KEY } from './LibraryStates'
import libraryStyles from './LibraryStates.module.scss'

const ROW_PX = 64
const ART_PX = 48

type Row = { kind: 'playlist'; playlist: LibraryPlaylist } | { kind: 'more'; failed: boolean }

const rowKey = (row: Row) => (row.kind === 'playlist' ? row.playlist.uri : MORE_KEY)

export interface PlaylistsPageProps {
  /** the row focused when the page was last covered */
  restoreKey?: string
}

/** The user's playlists, Liked Songs first; kept for the session so Back lands where it left. */
export function PlaylistsPage({ restoreKey }: PlaylistsPageProps) {
  const nav = useNavigation()
  const overlays = useOverlayState()
  const list = usePagedList(playlistsCache, PLAYLISTS_KEY)
  const { items, loaded, error, failedFirst, hasTail } = list

  const sections = useMemo<ListSection<Row>[]>(() => {
    const rows: Row[] = items.map((playlist) => ({ kind: 'playlist', playlist }))
    if (hasTail) rows.push({ kind: 'more', failed: !!error })
    return [{ key: 'playlists', items: rows }]
  }, [items, hasTail, error])
  const keys = useMemo(
    () => (failedFirst ? [RETRY_KEY] : sections[0].items.map(rowKey)),
    [failedFirst, sections],
  )

  const select = (key: string) => {
    if (key === RETRY_KEY || key === MORE_KEY) return list.retry()
    const playlist = items.find((p) => p.uri === key)
    if (!playlist) return
    // saved here as well: a tap pushes in the same tick, before the focus effect could report it
    nav.setFocusKey(key)
    nav.push({ id: 'playlist', params: { uri: playlist.uri, name: playlist.name } })
  }
  const knob = useKnobNav({
    keys,
    restoreKey,
    onSelect: select,
    disabled: (key) => key === MORE_KEY && !error,
    onFocus: nav.setFocusKey,
    enabled: !overlays.busy,
  })

  const total = loaded ? list.total : null
  const subtitle = total === null ? 'Your library' : `${total} in your library`

  return (
    <Page header={<PageHeader title="Playlists" subtitle={subtitle} />}>
      <LibraryBody
        list={list}
        loadingLabel="Loading playlists..."
        errorTitle="Couldn't load your playlists"
        retry={knob.itemProps(RETRY_KEY)}
      >
        <KnobList<Row, string>
          sections={sections}
          keyOf={rowKey}
          nav={knob}
          rowHeight={ROW_PX}
          className={libraryStyles.listInset}
          onEndReached={list.loadMore}
          renderRow={(row, { focused }) =>
            row.kind === 'more' ? (
              <MoreRow failed={row.failed} focused={focused} />
            ) : (
              <PlaylistRow playlist={row.playlist} focused={focused} />
            )
          }
          empty={
            <EmptyState
              size="page"
              icon="playlist"
              title="No playlists yet"
              body="Playlists you make or follow in Spotify show up here."
            />
          }
        />
      </LibraryBody>
    </Page>
  )
}

function PlaylistRow({ playlist, focused }: { playlist: LibraryPlaylist; focused: boolean }) {
  const liked = playlist.uri === LIKED_SONGS_URI
  return (
    <ListRow
      leading={
        <Artwork
          src={playlist.image_url || undefined}
          size={ART_PX}
          radius="sm"
          crossfade={false}
          fallback={liked ? 'liked' : 'playlist'}
        />
      }
      title={playlist.name}
      subtitle={playlist.owner || undefined}
      value={playlist.track_count !== null ? songCount(playlist.track_count) : undefined}
      focused={focused}
    />
  )
}
