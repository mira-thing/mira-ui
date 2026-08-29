import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AlbumArt } from '@/components/AlbumArt'
import { AuthScreen } from '@/components/AuthScreen'
import { BluetoothMenu } from '@/components/BluetoothMenu'
import { BootSplash } from '@/components/BootSplash'
import { CheckinConsent } from '@/components/CheckinConsent'
import { ConnectionChooser } from '@/components/ConnectionChooser'
import { Controls } from '@/components/Controls'
import { DevicePicker } from '@/components/DevicePicker'
import { IdleScreen } from '@/components/IdleScreen'
import { Lyrics } from '@/components/Lyrics'
import { Menu } from '@/components/Menu'
import { NeedsNetwork } from '@/components/NeedsNetwork'
import { NoLyricsView } from '@/components/NoLyricsView'
import { PairingDialog } from '@/components/PairingDialog'
import { ReportDialog } from '@/components/ReportDialog'
import { PcConnect } from '@/components/PcConnect'
import { PowerMenu } from '@/components/PowerMenu'
import { ProgressBar } from '@/components/ProgressBar'
import { ReconnectBanner, type ReconnectReason } from '@/components/ReconnectBanner'
import { ReconnectingScreen } from '@/components/ReconnectingScreen'
import { Screensaver } from '@/components/Screensaver'
import { SettingsSheet } from '@/components/SettingsSheet'
import { SponsorScreen } from '@/components/SponsorScreen'
import { TrackInfo } from '@/components/TrackInfo'
import { UpdateCard } from '@/components/UpdateCard'
import { VolumeOverlay } from '@/components/VolumeOverlay'
import { DebugScreen } from '@/components/DebugScreen'
import { resolveRoute, type OfflineScreen } from '@/app/routes'
import { useDevScreen } from '@/dev/devContext'
import { makeMockStatus } from '@/dev/mockStatus'
import { useAuth } from '@/hooks/useAuth'
import { useConnectDevices } from '@/hooks/useConnectDevices'
import { useCheckinConsent } from '@/hooks/useCheckinConsent'
import { useConnectivity } from '@/hooks/useConnectivity'
import { useControls } from '@/hooks/useControls'
import { useDelayedFlag } from '@/hooks/useDelayedFlag'
import { useDiscoverableWhilePairing } from '@/hooks/useDiscoverableWhilePairing'
import { useDeviceSwitch } from '@/hooks/useDeviceSwitch'
import { useHardwareButtons } from '@/hooks/useHardwareButtons'
import { useIdleScreensaver } from '@/hooks/useIdleScreensaver'
import { useLastArtUrl } from '@/hooks/useLastArtUrl'
import { isDJContext, NarrationContext, presentTrack, useDJNarration } from '@/hooks/useDJNarration'
import { useNotify } from '@/notify/notifyContext'
import { useObserver } from '@/hooks/useObserver'
import { useOfflineScreen } from '@/hooks/useOfflineScreen'
import { useOverlays, type OverlayId } from '@/hooks/useOverlays'
import { usePlayerControls } from '@/hooks/usePlayerControls'
import { usePrefetch } from '@/hooks/usePrefetch'
import { resolveDropReason, useHeldStatus } from '@/hooks/useReconnect'
import { useSavedTrack } from '@/hooks/useSavedTrack'
import { useSponsorGate } from '@/hooks/useSponsorGate'
import { useSwipeGestures } from '@/hooks/useSwipeGestures'
import { useUpdateNotice } from '@/hooks/useUpdateNotice'
import { useUtcOffset } from '@/hooks/useUtcOffset'
import { resumeLastDevice } from '@/api/client'
import type { ObserverStatusActive } from '@/api/types'
import { getSettings, initSettings, updateSettings, useSettings } from '@/settings'
import { artSizeFor, heroArtSizeFor } from '@/uiScale'
import styles from './App.module.scss'

export default function App() {
  const auth = useAuth()
  const {
    status: realStatus,
    loading,
    connected,
    setupProgress,
    narration: seenNarration,
  } = useObserver()
  const notify = useNotify()
  const { forced, setForced } = useDevScreen()

  // a forced screen shows its overlay without touching the real state
  const forcedOpen = useMemo(
    () => ({
      menu: forced === 'menu' || undefined,
      powerMenu: forced === 'power-menu' || undefined,
      btMenu: forced === 'bluetooth-menu' || undefined,
      settings: forced === 'settings' || undefined,
    }),
    [forced],
  )
  // closing a forced menu has to drop the override too, or it springs back
  const onOverlayClosed = useCallback(
    (id: OverlayId) => {
      if ((id === 'menu' && forced === 'menu') || (id === 'powerMenu' && forced === 'power-menu')) {
        setForced('playing-lyrics')
      }
    },
    [forced, setForced],
  )
  const overlays = useOverlays({ forcedOpen, onClosed: onOverlayClosed })
  const menuOpen = overlays.isOpen('menu')
  const powerMenuOpen = overlays.isOpen('powerMenu')
  const btMenuOpen = overlays.isOpen('btMenu')
  const settingsOpen = overlays.isOpen('settings')
  const deviceMenuOpen = overlays.isOpen('deviceMenu')
  const debugOpen = overlays.isOpen('debug')
  const screensaverOpen = overlays.isOpen('screensaver')
  const sponsorOpen = overlays.isOpen('sponsor')
  const consentOpen = overlays.isOpen('consent')
  const updateCardOpen = overlays.isOpen('updateCard')
  const reportId = overlays.reportId

  const { play, pause, next, prev, seek, playContext, setVolume, setShuffle, djSignal, setRepeat } =
    useControls()
  const handleSeek = useCallback(
    (positionMs: number) => {
      void seek(positionMs).catch(() => notify('Seek failed', { variant: 'error' }))
    },
    [notify, seek],
  )
  usePrefetch(realStatus)
  const {
    online,
    carriers,
    pairing: realPairing,
    trouble: btTrouble,
    setDiscoverable,
    hasKnownDevice,
    btConnectedDevice,
    topKnownDeviceName,
    wasOnline,
  } = useConnectivity()
  const connectDevices = useConnectDevices()

  const closeDeviceMenu = useCallback(() => overlays.close('deviceMenu'), [overlays])
  const onPickDevice = useDeviceSwitch({
    status: realStatus,
    notify,
    onPicked: closeDeviceMenu,
  })

  const settings = useSettings()
  const showLyricsReal = settings.showLyrics
  const artSize = artSizeFor(settings.uiScalePct)
  const heroArtSize = heroArtSizeFor(settings.uiScalePct)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const toggleLyrics = useCallback(() => {
    updateSettings({ showLyrics: !getSettings().showLyrics })
  }, [])

  const toggleKaraoke = useCallback(() => {
    updateSettings({ karaokeLyrics: !getSettings().karaokeLyrics })
  }, [])

  const toggleVoiceMic = useCallback(() => {
    updateSettings({ voiceMic: !getSettings().voiceMic })
  }, [])

  // get settings from the daemon
  useEffect(() => {
    void initSettings()
  }, [])

  // Cold-boot rescue: fall through from BootSplash to NeedsNetwork after
  // BOOT_STUCK_MS without an online signal, so the user gets actionable
  // instructions instead of staring at a splash forever.
  const BOOT_STUCK_MS = 12000
  const bootStuck = useDelayedFlag(true, BOOT_STUCK_MS)

  // if something goes wrong change the text to try restarting
  // TODO: maybe not needed at this point since some further changes while developing the bluetooth flow showed this was not an issue as i thought
  const LOAD_STUCK_MS = 30000
  const loadStuck = useDelayedFlag(true, LOAD_STUCK_MS)

  const mockStatus = useMemo<ObserverStatusActive>(() => makeMockStatus(), [])

  const status =
    forced === 'playing-lyrics' ||
    forced === 'playing-no-lyrics' ||
    forced === 'pairing' ||
    forced === 'menu' ||
    forced === 'power-menu' ||
    forced === 'bluetooth-menu' ||
    forced === 'reconnect-banner' ||
    forced === 'settings'
      ? mockStatus
      : realStatus

  const SPOTIFY_STUCK_MS = 60000
  const playerStartingUp = status != null && !status.active && status.message === 'starting up'
  const splashOnlineStuck = playerStartingUp && online === true && !auth.url
  const spotifyStuck = useDelayedFlag(splashOnlineStuck, SPOTIFY_STUCK_MS)

  // hold the last now-playing through any small drops in network
  const heldStatus = useHeldStatus(realStatus)

  // small drops while the phone is still reachable
  const dropReason = resolveDropReason({
    suppressed: !!forced,
    held: heldStatus,
    status: realStatus,
    online,
    connected,
  })
  const reconnecting = dropReason !== null

  const offline = useOfflineScreen({
    suppressed: !!forced,
    online,
    carriers,
    btConnectedDevice,
    hasKnownDevice,
    wasOnline,
    heldStatus,
    bootStuck,
    reconnecting,
  })
  const offlineScreen = offline.screen

  // seek relative to the live position
  const seekRelative = useCallback(
    (deltaMs: number) => {
      if (!status?.active) return
      const base = status.is_paused
        ? status.position
        : status.position + (Date.now() - status.received_at)
      const target = Math.min(status.duration, Math.max(0, base + deltaMs))
      void seek(target).catch(() => notify('Seek failed', { variant: 'error' }))
    },
    [status, seek, notify],
  )

  const showLyrics = forced === 'playing-no-lyrics' ? false : showLyricsReal
  const pairing =
    forced === 'pairing' ? { address: 'AB:CD:EF:01:23:45', passkey: '123456' } : realPairing

  // an overlay owns the screen, or something that is not an overlay does
  const overlayBusy = overlays.busy || !!forced || auth.required || reconnecting || !!pairing

  const openConsent = useCallback(() => overlays.open('consent'), [overlays])
  const openSponsor = useCallback(() => overlays.open('sponsor'), [overlays])
  const openUpdateCard = useCallback(() => overlays.open('updateCard'), [overlays])
  const closeUpdateCard = useCallback(() => overlays.close('updateCard'), [overlays])
  const closeConsent = useCallback(() => overlays.close('consent'), [overlays])
  const openScreensaverAuto = useCallback(() => overlays.openScreensaver('auto'), [overlays])
  const closeScreensaver = useCallback(() => overlays.close('screensaver'), [overlays])

  useIdleScreensaver({
    open: screensaverOpen,
    openedBy: overlays.screensaverBy,
    busy: overlayBusy,
    consentOpen,
    updateCardOpen,
    loading,
    status: realStatus,
    onOpen: openScreensaverAuto,
    onClose: closeScreensaver,
  })

  // discoverable while the Bluetooth pairing screen is up
  const pairingScreenShown = forced === 'needs-network' || offlineScreen === 'bluetooth'
  useDiscoverableWhilePairing({ pairingScreenShown, btMenuOpen, setDiscoverable })

  const closeMenu = useCallback(() => overlays.close('menu'), [overlays])
  const closePowerMenu = useCallback(() => overlays.close('powerMenu'), [overlays])

  const onOpenScreensaver = useCallback(() => {
    closePowerMenu()
    overlays.openScreensaver('manual')
  }, [closePowerMenu, overlays])

  // remembered across boots: the screensaver needs both on a cold start
  const lastArtUrl = useLastArtUrl(realStatus)
  const utcOffsetMin = useUtcOffset(realStatus)

  useSponsorGate({ status: realStatus, shown: overlays.sponsorShown, onShow: openSponsor })

  const { choose: chooseConsent } = useCheckinConsent({
    status: realStatus,
    loading,
    open: consentOpen,
    busy: overlayBusy,
    updateCardOpen,
    onAsk: openConsent,
    onAnswered: closeConsent,
  })

  const {
    version: latestVersion,
    highlights: latestHighlights,
    mandatory: updateMandatory,
    skip: skipVersion,
  } = useUpdateNotice({
    status: realStatus,
    loading,
    open: updateCardOpen,
    consentOpen,
    busy: overlayBusy,
    remindAt: overlays.updateRemindAt(),
    onShow: openUpdateCard,
    onDismiss: closeUpdateCard,
  })

  // hardware back button
  const goBack = useCallback(() => {
    if (overlays.goBack()) return
    if (offline.active && offline.method !== 'chooser') {
      offline.setMethod('chooser')
      return
    }
    // back out of the chooser the reconnecting screen pushed us into
    if (offline.active && offline.setupOverride) {
      offline.setSetupOverride(false)
      return
    }
    // nothing to go back to
  }, [overlays, offline])

  const controls = usePlayerControls({
    status: status && status.active ? status : null,
    play,
    pause,
    next,
    prev,
    seek,
    setShuffle,
    djSignal,
    setRepeat,
    onCommandError: (message) => notify(message, { variant: 'error' }),
  })

  const savableStatus = status && status.active ? status : reconnecting ? heldStatus : null
  // resolved here so the hook stays unconditional
  const isDJ = isDJContext(savableStatus)
  // owns the DJ hold
  const narration = useDJNarration(savableStatus, seenNarration)
  const savableUri =
    savableStatus && !savableStatus.track_uri.startsWith('spotify:episode:')
      ? savableStatus.track_uri
      : null
  const liked = useSavedTrack(savableUri, (message) => notify(message, { variant: 'error' }))

  const statusActive = status?.active === true
  const onPlayPauseActive = controls.onPlayPause
  const resumeLast = useCallback(() => {
    void resumeLastDevice().catch(() => {
      notify('Nothing to resume. Start playback on a device', { variant: 'info' })
    })
  }, [notify])
  const onHardwarePlayPause = useCallback(() => {
    if (statusActive) onPlayPauseActive()
    else resumeLast()
  }, [statusActive, onPlayPauseActive, resumeLast])

  // stable ref so the preset/chord effect isn't torn down on every re-render
  // (an unstable handler would clear the 1+4 chord timer before it fires)
  const openDebug = useCallback(() => overlays.open('debug'), [overlays])

  const hardware = useHardwareButtons({
    status: status && status.active ? status : null,
    onPlayPause: onHardwarePlayPause,
    setVolume,
    playContext,
    inDJSet: isDJ,
    djNarrating: narration.narrating,
    onDJSignal: controls.onDJSignal,
    onBack: goBack,
    onTogglePowerMenu: () => {
      if (screensaverOpen) {
        overlays.close('screensaver')
        return
      }
      overlays.toggle('powerMenu')
    },
    onScreensaver: onOpenScreensaver,
    onOpenDebug: openDebug,
    notify,
  })

  // touch gestures
  const swipeEnabled =
    status?.active === true &&
    !menuOpen &&
    !powerMenuOpen &&
    !deviceMenuOpen &&
    !btMenuOpen &&
    !settingsOpen &&
    !pairing
  useSwipeGestures(stageRef, {
    onNext: controls.onNext,
    onPrev: controls.onPrevTrack,
    onToggleView: toggleLyrics,
    enabled: swipeEnabled,
  })

  // ambient screensaver background
  let screensaverArt: string | null = null
  if (screensaverOpen || forced === 'screensaver') {
    screensaverArt =
      (status?.active === true ? status.track_image : '') || heldStatus?.track_image || lastArtUrl
  }

  const globalOverlays = (
    <>
      <VolumeOverlay state={hardware.volumeOverlay} />
      <PowerMenu
        open={powerMenuOpen}
        onClose={closePowerMenu}
        onSupport={() => {
          closePowerMenu()
          overlays.open('sponsor')
        }}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => overlays.close('settings')}
        phoneVolume={status !== null && status.active === true && status.volume_disabled === true}
      />
      {deviceMenuOpen ? (
        <DevicePicker
          devices={connectDevices}
          onSelect={onPickDevice}
          placement="modal"
          onClose={() => overlays.close('deviceMenu')}
        />
      ) : null}
      {btMenuOpen ? (
        <BluetoothMenu online={online} onClose={() => overlays.close('btMenu')} />
      ) : null}
      <DebugScreen
        open={debugOpen}
        onClose={() => overlays.close('debug')}
        onReport={overlays.openReport}
      />
      {pairing ? <PairingDialog passkey={pairing.passkey} address={pairing.address} /> : null}
      {reportId ? <ReportDialog id={reportId} onDismiss={() => overlays.close('report')} /> : null}
      {sponsorOpen ? <SponsorScreen onClose={() => overlays.close('sponsor')} /> : null}
      {consentOpen && !overlayBusy ? <CheckinConsent onChoose={chooseConsent} /> : null}
      {updateCardOpen ? (
        <UpdateCard
          latest={latestVersion}
          highlights={latestHighlights}
          mandatory={updateMandatory}
          onRemindLater={overlays.remindLater}
          onSkip={skipVersion}
        />
      ) : null}
      {screensaverOpen ? (
        <Screensaver
          artUrl={screensaverArt}
          utcOffsetMin={utcOffsetMin}
          onClose={() => overlays.close('screensaver')}
        />
      ) : null}
    </>
  )

  if (forced === 'connection-chooser') {
    return (
      <div className={styles.app}>
        <ConnectionChooser
          onPickPc={() => setForced('pc-connect')}
          onPickBluetooth={() => setForced('needs-network')}
        />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'pc-connect') {
    return (
      <div className={styles.app}>
        <PcConnect />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'needs-network') {
    return (
      <div className={styles.app}>
        <NeedsNetwork />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'starting') {
    return (
      <div className={styles.app}>
        <BootSplash caption="starting up" />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'setting-up') {
    return (
      <div className={styles.app}>
        <BootSplash caption="setting things up" progress={47} />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'boot-splash') {
    return (
      <div className={styles.app}>
        <BootSplash />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'sponsor') {
    return (
      <div className={styles.app}>
        <SponsorScreen onClose={() => setForced(null)} />
      </div>
    )
  }
  if (forced === 'screensaver') {
    return (
      <div className={styles.app}>
        <Screensaver
          artUrl={mockStatus.track_image}
          utcOffsetMin={utcOffsetMin}
          onClose={() => setForced(null)}
        />
      </div>
    )
  }
  if (forced === 'consent') {
    return (
      <div className={styles.app}>
        <CheckinConsent onChoose={() => setForced(null)} />
      </div>
    )
  }
  if (forced === 'update-card') {
    return (
      <div className={styles.app}>
        <UpdateCard
          latest="1.1.0"
          highlights={[
            'Clock screensaver (double-press power)',
            'Setup progress bar',
            'Bluetooth pairing fixes',
          ]}
          onRemindLater={() => setForced(null)}
          onSkip={() => setForced(null)}
        />
      </div>
    )
  }
  if (forced === 'debug') {
    return (
      <div className={styles.app}>
        <DebugScreen open onClose={() => setForced(null)} onReport={overlays.openReport} />
        {reportId ? (
          <ReportDialog id={reportId} onDismiss={() => overlays.close('report')} />
        ) : null}
      </div>
    )
  }
  if (forced === 'auth') {
    return (
      <>
        <AuthScreen url="https://accounts.spotify.com/authorize?response_type=code&client_id=dev-mock&redirect_uri=https%3A%2F%2Fexample.com%2Fcb&scope=user-read-private" />
        {globalOverlays}
      </>
    )
  }
  if (forced === 'idle') {
    return (
      <div className={styles.app}>
        <IdleScreen connected={connected} devices={connectDevices} onSelectDevice={onPickDevice} />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'reconnecting') {
    return (
      <div className={styles.app}>
        <ReconnectingScreen
          deviceName="Kaz’s S24"
          carriers={{ usb: false, bt: false }}
          onSetUpOther={() => {}}
        />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'no-internet') {
    return (
      <div className={styles.app}>
        <ReconnectingScreen
          phase="no-internet"
          deviceName="Kaz’s S24"
          carriers={{ usb: false, bt: false }}
          onSetUpOther={() => {}}
        />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'checking') {
    return (
      <div className={styles.app}>
        <ReconnectingScreen phase="checking" />
        {globalOverlays}
      </div>
    )
  }

  const offlineScreenFor = (screen: OfflineScreen) => {
    switch (screen) {
      case 'checking':
        return <ReconnectingScreen phase="checking" deviceName={topKnownDeviceName} />
      case 'tethering':
        return <NeedsNetwork />
      case 'reconnecting':
        return (
          <ReconnectingScreen
            phase="reconnecting"
            deviceName={topKnownDeviceName}
            carriers={carriers}
            trouble={btTrouble}
            onSetUpOther={() => offline.setSetupOverride(true)}
          />
        )
      case 'pc':
        return <PcConnect />
      case 'bluetooth':
        return <NeedsNetwork />
      default:
        return (
          <ConnectionChooser
            onPickPc={() => offline.setMethod('pc')}
            onPickBluetooth={() => offline.setMethod('bluetooth')}
          />
        )
    }
  }

  if (!forced) {
    const route = resolveRoute({
      offlineScreen,
      auth,
      status,
      setupProgress,
      loading,
      online,
      reconnecting,
      playerStartingUp,
      spotifyStuck,
      splashOnlineStuck,
      loadStuck,
    })

    switch (route.kind) {
      case 'offline':
        return (
          <div className={styles.app}>
            {offlineScreenFor(route.screen)}
            {globalOverlays}
          </div>
        )
      case 'auth':
        return (
          <>
            <AuthScreen url={route.url} />
            {globalOverlays}
          </>
        )
      case 'spotify-unreachable':
        return (
          <div className={styles.app}>
            <ReconnectingScreen phase="spotify-unreachable" />
            {globalOverlays}
          </div>
        )
      // hides the starting up screen on first boot after a successful bluetooth pairing with pan
      case 'auth-pending':
        return (
          <>
            <AuthScreen
              hint={
                route.stuck
                  ? 'Still fetching from Spotify if this persists, try unplugging and replugging.'
                  : undefined
              }
            />
            {globalOverlays}
          </>
        )
      case 'booting':
        return (
          <div className={styles.app}>
            <BootSplash
              caption="starting up"
              hint={
                route.stuck
                  ? 'Still connecting to Spotify if this persists for another minute, try unplugging and replugging.'
                  : undefined
              }
            />
            {globalOverlays}
          </div>
        )
      case 'setting-up':
        return (
          <div className={styles.app}>
            <BootSplash caption="setting things up" progress={route.progress} />
            {globalOverlays}
          </div>
        )
      case 'idle':
        return (
          <div className={styles.app}>
            <IdleScreen
              connected={connected}
              devices={connectDevices}
              onSelectDevice={onPickDevice}
            />
            {globalOverlays}
          </div>
        )
      case 'player':
        break
    }
  }

  // live status when active otherwise the last playing
  const playerStatus = status && status.active ? status : reconnecting ? heldStatus : null
  if (!playerStatus || !playerStatus.active) return null
  const isPodcast = playerStatus.track_uri.startsWith('spotify:episode:')
  // presentTrack substitutes the DJ while it talks
  const shown = presentTrack(playerStatus, narration)

  // noti over the player on a network drops
  const bannerReason: ReconnectReason | null =
    forced === 'reconnect-banner' ? 'offline' : reconnecting ? dropReason : null

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
                <Lyrics status={playerStatus} onSeek={handleSeek} active={showLyrics} />
              </div>
            </div>
          </div>
          <div
            className={`${styles.viewLayer} ${!showLyrics ? styles.viewActive : styles.viewInactive}`}
          >
            <div
              className={`${styles.topNoLyrics} ${controls.transitioning ? styles.transitioning : ''}`}
            >
              <NoLyricsView status={playerStatus} active={!showLyrics} artSize={heroArtSize} />
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <ProgressBar status={playerStatus} onSeek={handleSeek} />
          <Controls
            isPaused={controls.isPaused}
            shuffle={controls.shuffle}
            repeat={controls.repeat}
            disallowPrev={playerStatus.disallow_prev}
            disallowNext={playerStatus.disallow_next}
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
            onRewind15={() => seekRelative(-15000)}
            onForward15={() => seekRelative(15000)}
            onMore={() => overlays.open('menu')}
          />
        </div>

        <Menu
          open={menuOpen}
          onClose={closeMenu}
          showLyrics={showLyrics}
          onToggleLyrics={toggleLyrics}
          karaokeLyrics={settings.karaokeLyrics}
          onToggleKaraoke={toggleKaraoke}
          voiceMic={settings.voiceMic}
          onToggleVoiceMic={toggleVoiceMic}
          currentDevice={playerStatus.device_name}
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

        {globalOverlays}
      </div>
    </NarrationContext.Provider>
  )
}
