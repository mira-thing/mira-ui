import { useMemo } from 'react'
import { useNavigation } from '@/app/navigation'
import { BRAND_NAME } from '@/brand'
import type { TrackPresentation } from '@/hooks/useDJNarration'
import { useKnobNav } from '@/input/useKnobNav'
import { useOverlayState } from '@/overlays/overlayContext'
import { Artwork } from '@/ui/Artwork'
import { Card, Carousel } from '@/ui/Carousel'
import { Page, PageHeader } from '@/ui/Page'
import { HomeClock } from './HomeClock'
import { homeCardKey, homeCards, type HomeCard, type HomeCardKey } from './homeCards'
import styles from './HomePage.module.scss'

const COVER_PX = 112

export interface HomePageProps {
  /** what the player is presenting, or null when nothing plays */
  nowPlaying: TrackPresentation | null
  /** the daemon is reachable */
  connected: boolean
  /** the device playing, when one is */
  deviceName: string | null
  deviceCount: number
  /** what the Queue card says is up next */
  queueSummary: string
  btDeviceName: string | null
  /** resumes playback on the last device */
  onResume: () => void
  /** minutes from UTC for the header clock, or null for the browser's own zone */
  utcOffsetMin: number | null
}

function subtitleFor({ nowPlaying, connected, deviceName }: HomePageProps): string {
  if (!connected) return 'Reconnecting...'
  if (!nowPlaying) return 'Nothing playing'
  return deviceName ? `Playing on ${deviceName}` : 'Playing'
}

/** The root of the page stack: a carousel into everything else, under the player while it plays. */
export function HomePage(props: HomePageProps) {
  const {
    nowPlaying,
    deviceName,
    deviceCount,
    queueSummary,
    btDeviceName,
    onResume,
    utcOffsetMin,
  } = props
  const nav = useNavigation()
  const overlays = useOverlayState()

  // App builds `nowPlaying` afresh every render, so the cards key off its fields
  const { title, artist, art, djFallback } = nowPlaying ?? {}
  const cards = useMemo(
    () =>
      homeCards({
        nowPlaying:
          title !== undefined && artist !== undefined && art !== undefined
            ? { title, artist, art, djFallback: !!djFallback }
            : null,
        deviceName,
        deviceCount,
        queueSummary,
        btDeviceName,
      }),
    [title, artist, art, djFallback, deviceName, deviceCount, queueSummary, btDeviceName],
  )
  const keys = useMemo(() => cards.map(homeCardKey), [cards])

  const select = (key: HomeCardKey) => {
    switch (key) {
      case 'now-playing':
        return nav.push({ id: 'player' })
      case 'resume':
        return onResume()
      case 'playlists':
        return nav.push({ id: 'playlists' })
      case 'queue':
        return nav.push({ id: 'queue' })
      case 'devices':
        return overlays.open('deviceMenu')
      case 'bluetooth':
        return overlays.open('btMenu')
      case 'settings':
        return overlays.open('settings')
    }
  }
  // stands down under a sheet, as the player's swipes do, so the knob never moves cards behind it
  const knob = useKnobNav({ keys, onSelect: select, enabled: !overlays.busy })

  const renderCard = (card: HomeCard, { focused }: { focused: boolean }) => (
    <Card
      icon={card.icon}
      media={
        card.track ? (
          <Artwork
            src={card.track.art || undefined}
            size={COVER_PX}
            radius="sm"
            fallback={card.track.djFallback ? 'dj' : 'none'}
            crossfade={false}
          />
        ) : undefined
      }
      title={card.title}
      subtitle={card.subtitle}
      focused={focused}
    />
  )

  return (
    <Page
      className={styles.home}
      header={
        <div className={styles.header}>
          <PageHeader
            title={BRAND_NAME}
            subtitle={subtitleFor(props)}
            trailing={<HomeClock utcOffsetMin={utcOffsetMin} />}
          />
        </div>
      }
    >
      <Carousel items={cards} keyOf={homeCardKey} nav={knob} renderItem={renderCard} />
    </Page>
  )
}
