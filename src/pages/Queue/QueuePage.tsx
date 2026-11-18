import { useMemo } from 'react'
import type { QueueTrack } from '@/api/types'
import type { TrackPresentation } from '@/hooks/useDJNarration'
import { useKnobNav } from '@/input/useKnobNav'
import { useOverlayState } from '@/overlays/overlayContext'
import { Artwork } from '@/ui/Artwork'
import { EmptyState } from '@/ui/EmptyState'
import { KnobList, ListRow, SectionHeader } from '@/ui/List'
import { Page, PageHeader } from '@/ui/Page'
import { TrackText } from '@/ui/TrackText'
import { upNextItems, upNextKey, upNextSummary, type UpNextItem } from './upNext'
import styles from './QueuePage.module.scss'

const ROW_PX = 64
const ROW_ART_PX = 44
const NOW_ART_PX = 64

export interface QueuePageProps {
  /** what the player is presenting, or null when nothing plays */
  nowPlaying: TrackPresentation | null
  /** the tracks after the current one, as the daemon reports them; empty when nothing plays */
  upNext: readonly QueueTrack[]
}

// rows take focus but do nothing yet
const ignoreSelect = () => {}

function NowPlaying({ track }: { track: TrackPresentation }) {
  return (
    <section className={styles.nowPlaying} aria-label="Now playing">
      <Artwork
        src={track.art || undefined}
        size={NOW_ART_PX}
        radius="sm"
        fallback={track.djFallback ? 'dj' : 'none'}
        crossfade={false}
      />
      <div className={styles.nowText}>
        <span className={styles.overline}>Now playing</span>
        <TrackText title={track.title} artist={track.artist} size="mini" scroll={false} />
      </div>
    </section>
  )
}

function UpNextRow({ track }: UpNextItem, { focused }: { focused: boolean }) {
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
      title={track.name || 'Unknown track'}
      subtitle={track.artist || undefined}
      focused={focused}
    />
  )
}

/** What plays now and the next few tracks after it. Read-only until the daemon can edit it. */
export function QueuePage({ nowPlaying, upNext }: QueuePageProps) {
  const overlays = useOverlayState()
  const items = useMemo(() => upNextItems(upNext), [upNext])
  const sections = useMemo(() => [{ key: 'up-next', items }], [items])
  const keys = useMemo(() => items.map(upNextKey), [items])
  // an empty list still keeps the knob off the volume
  const nav = useKnobNav({ keys, onSelect: ignoreSelect, enabled: !overlays.busy })

  const header = (
    <>
      <PageHeader title="Queue" subtitle={nowPlaying ? upNextSummary(upNext) : 'Nothing playing'} />
      {nowPlaying ? <NowPlaying track={nowPlaying} /> : null}
    </>
  )

  if (!nowPlaying) {
    return (
      <Page header={header}>
        <EmptyState
          size="page"
          icon="queue"
          title="Nothing playing"
          body="Start something on Spotify to see what's up next."
        />
      </Page>
    )
  }

  return (
    <Page header={header}>
      <div className={styles.upNext}>
        {/* outside the scroller, so it never scrolls out from under the header */}
        {items.length > 0 ? <SectionHeader className={styles.label}>Up next</SectionHeader> : null}
        <KnobList
          className={styles.list}
          sections={sections}
          keyOf={upNextKey}
          nav={nav}
          rowHeight={ROW_PX}
          renderRow={UpNextRow}
          empty={
            <EmptyState
              size="page"
              icon="queue"
              title="Nothing queued"
              body="Tracks you add to the queue show up here."
            />
          }
        />
      </div>
    </Page>
  )
}
