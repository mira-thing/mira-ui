import { useCallback, useRef, type ReactNode } from 'react'
import { AlbumArt } from '@/components/AlbumArt'
import { Controls } from '@/components/Controls'
import { Lyrics } from '@/components/Lyrics'
import { Menu } from '@/components/Menu'
import { NoLyricsView } from '@/components/NoLyricsView'
import { ProgressBar } from '@/components/ProgressBar'
import { ReconnectBanner, type ReconnectReason } from '@/components/ReconnectBanner'
import { TrackInfo } from '@/components/TrackInfo'
import {
  isDJContext,
  NarrationContext,
  presentTrack,
  type DJNarration,
} from '@/hooks/useDJNarration'
import { useSavedTrack } from '@/hooks/useSavedTrack'
import { useSwipeGestures } from '@/hooks/useSwipeGestures'
import type { UsePlayerControlsResult } from '@/hooks/usePlayerControls'
import type { Carriers, PairingPrompt } from '@/hooks/useBluetooth'
import { useOverlayState } from '@/overlays/overlayContext'
import type { ObserverStatusActive } from '@/api/types'
import type { NotifyFn } from '@/notify/notifyContext'
import { getSettings, updateSettings, useSettings } from '@/settings'
import { artSizeFor, heroArtSizeFor } from '@/uiScale'
import styles from '@/App.module.scss'

const SKIP_MS = 15000

export interface PlayerPageProps {
  /** live while playing, or the held status while a drop recovers */
  status: ObserverStatusActive
  controls: UsePlayerControlsResult
  /** app-level, because the hardware buttons need it on every screen */
  narration: DJNarration
  showLyrics: boolean
  bannerReason: ReconnectReason | null
  carriers: Carriers | null
  /** a pairing dialog owns the screen, so swipes stand down */
  pairing: PairingPrompt | null
  seek: (positionMs: number) => Promise<void>
  notify: NotifyFn
  /** the overlay host, which renders inside the player's own container */
  children?: ReactNode
}

export function PlayerPage({
  status,
  controls,
  narration,
  showLyrics,
  bannerReason,
  carriers,
  pairing,
  seek,
  notify,
  children,
}: PlayerPageProps) {
  const overlays = useOverlayState()
  const settings = useSettings()
  const artSize = artSizeFor(settings.uiScalePct)
  const heroArtSize = heroArtSizeFor(settings.uiScalePct)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const onSeek = useCallback(
    (positionMs: number) => {
      void seek(positionMs).catch(() => notify('Seek failed', { variant: 'error' }))
    },
    [seek, notify],
  )

  // relative to where playback actually is now, not where the last status said
  const seekRelative = useCallback(
    (deltaMs: number) => {
      const base = status.is_paused
        ? status.position
        : status.position + (Date.now() - status.received_at)
      const target = Math.min(status.duration, Math.max(0, base + deltaMs))
      void seek(target).catch(() => notify('Seek failed', { variant: 'error' }))
    },
    [status, seek, notify],
  )

  const isPodcast = status.track_uri.startsWith('spotify:episode:')
  const isDJ = isDJContext(status)
  const savableUri = isPodcast ? null : status.track_uri
  const liked = useSavedTrack(savableUri, (message) => notify(message, { variant: 'error' }))

  const toggleLyrics = useCallback(() => {
    updateSettings({ showLyrics: !getSettings().showLyrics })
  }, [])

  const swipeEnabled =
    !overlays.isOpen('menu') &&
    !overlays.isOpen('powerMenu') &&
    !overlays.isOpen('deviceMenu') &&
    !overlays.isOpen('btMenu') &&
    !overlays.isOpen('settings') &&
    !pairing
  useSwipeGestures(stageRef, {
    onNext: controls.onNext,
    onPrev: controls.onPrevTrack,
    onToggleView: toggleLyrics,
    enabled: swipeEnabled,
  })

  // presentTrack substitutes the DJ while it talks
  const shown = presentTrack(status, narration)

  return (
    // provided once for all consumers
    <NarrationContext.Provider value={narration}>
      <div
        className={`${styles.app} ${styles.appPlaying}`}
        // the art is the only fixed-height block in the left column and never shrinks, so
        // it has to give way when a larger display size shortens the logical viewport
        style={{ '--art-size': `${artSize}px` } as React.CSSProperties}
      >
        {bannerReason ? <ReconnectBanner reason={bannerReason} carriers={carriers} /> : null}
        <div className={styles.stage} ref={stageRef}>
          <div
            className={`${styles.viewLayer} ${showLyrics ? styles.viewActive : styles.viewInactive}`}
          >
            <div className={styles.top}>
              <div
                className={`${styles.left} ${controls.transitioning ? styles.transitioning : ''}`}
              >
                <AlbumArt src={shown.art} size={artSize} djFallback={shown.djFallback} />
                <TrackInfo trackName={shown.title} artist={shown.artist} />
              </div>
              <div className={styles.right}>
                <Lyrics status={status} onSeek={onSeek} active={showLyrics} />
              </div>
            </div>
          </div>
          <div
            className={`${styles.viewLayer} ${!showLyrics ? styles.viewActive : styles.viewInactive}`}
          >
            <div
              className={`${styles.topNoLyrics} ${controls.transitioning ? styles.transitioning : ''}`}
            >
              <NoLyricsView status={status} active={!showLyrics} artSize={heroArtSize} />
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <ProgressBar status={status} onSeek={onSeek} />
          <Controls
            isPaused={controls.isPaused}
            shuffle={controls.shuffle}
            repeat={controls.repeat}
            disallowPrev={status.disallow_prev}
            disallowNext={status.disallow_next}
            isPodcast={isPodcast}
            isDJ={isDJ}
            showSave={!isPodcast}
            saved={liked.saved}
            onToggleSaved={liked.toggle}
            onPrev={controls.onPrev}
            onNext={controls.onNext}
            onPlayPause={controls.onPlayPause}
            onToggleShuffle={controls.onToggleShuffle}
            onDJSignal={controls.onDJSignal}
            onCycleRepeat={controls.onCycleRepeat}
            onRewind15={() => seekRelative(-SKIP_MS)}
            onForward15={() => seekRelative(SKIP_MS)}
            onMore={() => overlays.open('menu')}
          />
        </div>

        <Menu
          open={overlays.isOpen('menu')}
          onClose={() => overlays.close('menu')}
          showLyrics={showLyrics}
          onToggleLyrics={toggleLyrics}
          karaokeLyrics={settings.karaokeLyrics}
          onToggleKaraoke={() => updateSettings({ karaokeLyrics: !getSettings().karaokeLyrics })}
          voiceMic={settings.voiceMic}
          onToggleVoiceMic={() => updateSettings({ voiceMic: !getSettings().voiceMic })}
          currentDevice={status.device_name}
          onOpenDevices={() => {
            overlays.close('menu')
            overlays.open('deviceMenu')
          }}
          onOpenBluetooth={() => {
            overlays.close('menu')
            overlays.open('btMenu')
          }}
          onOpenSettings={() => {
            overlays.close('menu')
            overlays.open('settings')
          }}
        />

        {children}
      </div>
    </NarrationContext.Provider>
  )
}
