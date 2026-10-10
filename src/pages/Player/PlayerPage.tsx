import { useCallback, useRef, type ReactNode } from 'react'
import { AlbumArt } from '@/components/AlbumArt'
import {
  ArtworkSurface,
  ArtworkTheme,
  BackgroundDepth,
  usePanelPaintCache,
} from '@/components/AmbientGround'
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
import { useTrackScene } from '@/hooks/useTrackScene'
import type { UsePlayerControlsResult } from '@/hooks/usePlayerControls'
import type { Carriers, PairingPrompt } from '@/hooks/useBluetooth'
import { useOverlayState } from '@/overlays/overlayContext'
import type { ObserverStatusActive } from '@/api/types'
import type { NotifyFn } from '@/notify/notifyContext'
import { getSettings, updateSettings, useSettings } from '@/settings'
import { artSizeFor, heroArtSizeFor, useUiScale } from '@/uiScale'
import styles from '@/App.module.scss'

const SKIP_MS = 15000

export interface PlayerPageProps {
  /** live while playing, or the held status while a drop recovers */
  status: ObserverStatusActive
  /** false while `status` is the held one: the daemon cannot be reached */
  live: boolean
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
  live,
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
  const uiScale = useUiScale()
  const appRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  usePanelPaintCache(appRef, String(artSize), uiScale)

  const onSeek = useCallback(
    (positionMs: number) => {
      void seek(positionMs).catch(() => notify('Seek failed', { variant: 'error' }))
    },
    [seek, notify],
  )

  // relative to where playback actually is now, not where the last status said
  const seekRelative = useCallback(
    (deltaMs: number) => {
      if (!live) return
      const base = status.is_paused
        ? status.position
        : status.position + (Date.now() - status.received_at)
      const target = Math.min(status.duration, Math.max(0, base + deltaMs))
      void seek(target).catch(() => notify('Seek failed', { variant: 'error' }))
    },
    [live, status, seek, notify],
  )

  const isPodcast = status.track_uri.startsWith('spotify:episode:')
  const isDJ = isDJContext(status)
  const savableUri = isPodcast ? null : status.track_uri
  const liked = useSavedTrack(savableUri, (message) => notify(message, { variant: 'error' }))

  const toggleLyrics = useCallback(() => {
    updateSettings({ showLyrics: !getSettings().showLyrics })
  }, [])

  const swipeEnabled =
    live &&
    !overlays.isOpen('menu') &&
    !overlays.isOpen('powerMenu') &&
    !overlays.isOpen('deviceMenu') &&
    !overlays.isOpen('btMenu') &&
    !overlays.isOpen('settings') &&
    !pairing
  const scene = useTrackScene(status, controls.transitioning, controls.trackTransition)
  useSwipeGestures(stageRef, {
    onNext: controls.onNext,
    onPrev: controls.onPrevTrack,
    onToggleView: toggleLyrics,
    enabled: swipeEnabled,
  })

  // presentTrack substitutes the DJ while it talks
  const sceneStatus = scene.status ?? status
  const shown = presentTrack(sceneStatus, narration)

  return (
    // provided once for all consumers
    <NarrationContext.Provider value={narration}>
      <div
        ref={appRef}
        className={`${styles.app} ${styles.appPlaying}`}
        // the art is the only fixed-height block in the left column and never shrinks, so
        // it has to give way when a larger display size shortens the logical viewport
        style={{ '--art-size': `${artSize}px` } as React.CSSProperties}
      >
        <ArtworkTheme artUrl={shown.art}>
          <BackgroundDepth layoutKey={String(artSize)} showLyrics={showLyrics} />
          {bannerReason ? <ReconnectBanner reason={bannerReason} carriers={carriers} /> : null}
          <div className={styles.stage} ref={stageRef}>
            <div className={styles.trackScene} ref={scene.ref}>
              <div
                className={`${styles.viewLayer} ${showLyrics ? styles.viewActive : styles.viewInactive}`}
                data-track-active={showLyrics}
              >
                <div className={styles.top}>
                  <ArtworkSurface data-depth-panel="lyrics" className={styles.left} strength={0.2}>
                    <AlbumArt
                      src={shown.art}
                      size={artSize}
                      djFallback={shown.djFallback}
                      pending={scene.pending}
                    />
                    <TrackInfo trackName={shown.title} artist={shown.artist} compact />
                  </ArtworkSurface>
                  <div className={styles.right} data-depth-panel="lyrics">
                    <Lyrics
                      status={sceneStatus}
                      onSeek={
                        !controls.transitioning && sceneStatus.track_id === status.track_id
                          ? onSeek
                          : undefined
                      }
                      active={showLyrics}
                    />
                  </div>
                </div>
              </div>
              <div
                className={`${styles.viewLayer} ${!showLyrics ? styles.viewActive : styles.viewInactive}`}
                data-track-active={!showLyrics}
              >
                <div className={styles.topNoLyrics} data-depth-panel="art">
                  <NoLyricsView {...shown} artSize={heroArtSize} pending={scene.pending} />
                </div>
              </div>
            </div>
          </div>

          <ArtworkSurface data-depth-panel="" className={styles.bottom} strength={0.14}>
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
          </ArtworkSurface>

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
        </ArtworkTheme>
      </div>
    </NarrationContext.Provider>
  )
}
