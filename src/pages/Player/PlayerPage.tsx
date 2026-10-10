import { useCallback } from 'react'
import { BackgroundDepth } from '@/components/AmbientGround'
import { Controls } from '@/components/Controls'
import { Lyrics } from '@/components/Lyrics'
import { Menu } from '@/components/Menu'
import { NoLyricsView } from '@/components/NoLyricsView'
import { ProgressBar } from '@/components/ProgressBar'
import { ReconnectBanner, type ReconnectReason } from '@/components/ReconnectBanner'
import {
  isDJContext,
  NarrationContext,
  presentTrack,
  type DJNarration,
} from '@/hooks/useDJNarration'
import { useSavedTrack } from '@/hooks/useSavedTrack'
import { useSwipeGestures } from '@/hooks/useSwipeGestures'
import type { useTrackScene } from '@/hooks/useTrackScene'
import type { UsePlayerControlsResult } from '@/hooks/usePlayerControls'
import type { Carriers, PairingPrompt } from '@/hooks/useBluetooth'
import { useOverlayState } from '@/overlays/overlayContext'
import type { ObserverStatusActive } from '@/api/types'
import type { NotifyFn } from '@/notify/notifyContext'
import { getSettings, updateSettings, useSettings } from '@/settings'
import { Artwork } from '@/ui/Artwork'
import { Surface } from '@/ui/Surface'
import { TrackText } from '@/ui/TrackText'
import styles from '@/App.module.scss'
import { artSizeFor, heroArtSizeFor } from './playerLayout'

const SKIP_MS = 15000

export interface PlayerPageProps {
  /** live while playing, or the held status while a drop recovers */
  status: ObserverStatusActive
  /** false while `status` is the held one: the daemon cannot be reached */
  live: boolean
  controls: UsePlayerControlsResult
  /** app-level, so the shell's theme changes with the cover */
  scene: ReturnType<typeof useTrackScene>
  /** app-level, because the hardware buttons need it on every screen */
  narration: DJNarration
  showLyrics: boolean
  bannerReason: ReconnectReason | null
  carriers: Carriers | null
  /** a pairing dialog owns the screen, so swipes stand down */
  pairing: PairingPrompt | null
  seek: (positionMs: number) => Promise<void>
  notify: NotifyFn
}

export function PlayerPage({
  status,
  live,
  controls,
  scene,
  narration,
  showLyrics,
  bannerReason,
  carriers,
  pairing,
  seek,
  notify,
}: PlayerPageProps) {
  const overlays = useOverlayState()
  const settings = useSettings()
  const artSize = artSizeFor(settings.uiScalePct)
  const heroArtSize = heroArtSizeFor(settings.uiScalePct)

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
  const stageRef = useSwipeGestures<HTMLDivElement>({
    onNext: controls.onNext,
    onPrev: controls.onPrevTrack,
    onToggleView: toggleLyrics,
    enabled: swipeEnabled,
    onDrag: scene.drag,
    onDragEnd: scene.release,
    canNext: !status.disallow_next,
    canPrev: !status.disallow_prev,
  })

  // presentTrack substitutes the DJ while it talks
  const sceneStatus = scene.status ?? status
  const shown = presentTrack(sceneStatus, narration)

  return (
    // provided once for all consumers
    <NarrationContext.Provider value={narration}>
      <div
        className={`${styles.app} ${styles.appPlaying}`}
        // the art is the only fixed-height block in the left column and never shrinks, so
        // it has to give way when a larger display size shortens the logical viewport
        style={{ '--art-size': `${artSize}px` } as React.CSSProperties}
      >
        <BackgroundDepth layoutKey={String(artSize)} showLyrics={showLyrics} />
        {bannerReason ? <ReconnectBanner reason={bannerReason} carriers={carriers} /> : null}
        <div className={styles.stage} ref={stageRef}>
          <div className={styles.trackScene} ref={scene.ref}>
            <div
              className={`${styles.viewLayer} ${showLyrics ? styles.viewActive : styles.viewInactive}`}
              data-track-active={showLyrics}
            >
              <div className={styles.top}>
                <Surface variant="panel" depth="lyrics" className={styles.left}>
                  <Artwork
                    src={shown.art}
                    size={artSize}
                    fallback={shown.djFallback ? 'dj' : 'none'}
                    pending={scene.pending}
                  />
                  <TrackText title={shown.title} artist={shown.artist} size="panel" />
                </Surface>
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

        <Surface variant="bar" depth="" className={styles.bottom}>
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
        </Surface>

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
      </div>
    </NarrationContext.Provider>
  )
}
