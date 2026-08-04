import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlbumArt } from '@/components/AlbumArt'
import { AuthScreen } from '@/components/AuthScreen'
import { BluetoothMenu } from '@/components/BluetoothMenu'
import { BootSplash } from '@/components/BootSplash'
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
import { SettingsSheet } from '@/components/SettingsSheet'
import { TrackInfo } from '@/components/TrackInfo'
import { VolumeOverlay } from '@/components/VolumeOverlay'
import { DebugScreen } from '@/components/DebugScreen'
import { useDevScreen } from '@/dev/devContext'
import { makeMockStatus } from '@/dev/mockStatus'
import { useAuth } from '@/hooks/useAuth'
import { useBluetooth } from '@/hooks/useBluetooth'
import { useConnectDevices } from '@/hooks/useConnectDevices'
import { suspendDevice } from '@/api/system'
import { useControls } from '@/hooks/useControls'
import { useHardwareButtons } from '@/hooks/useHardwareButtons'
import { useKnownDevices } from '@/hooks/useKnownDevices'
import { useNotify } from '@/notify/notifyContext'
import { useObserver } from '@/hooks/useObserver'
import { usePlayerControls } from '@/hooks/usePlayerControls'
import { usePrefetch } from '@/hooks/usePrefetch'
import { useSavedTrack } from '@/hooks/useSavedTrack'
import { useSwipeGestures } from '@/hooks/useSwipeGestures'
import { resumeLastDevice, transferToDevice } from '@/api/client'
import type { ConnectDevice, ObserverStatusActive } from '@/api/types'
import { getSettings, initSettings, updateSettings, useSettings } from '@/settings'
import { artSizeFor, heroArtSizeFor } from '@/uiScale'
import styles from './App.module.scss'

export default function App() {
  const auth = useAuth()
  const { status: realStatus, loading, connected } = useObserver()
  const notify = useNotify()
  const { play, pause, next, prev, seek, playContext, setVolume, setShuffle, setRepeat } =
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
  } = useBluetooth()
  const connectDevices = useConnectDevices()
  const { devices: knownDevices } = useKnownDevices(true) // paired bt devices
  const hasKnownDevice = (knownDevices?.length ?? 0) > 0
  const btConnectedDevice = knownDevices?.find((d) => d.connected) ?? null
  const topKnownDeviceName = knownDevices?.[0]?.name ?? null
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false)

  // notification for the playback device changes
  const prevDeviceRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (realStatus == null) return
    const curId = realStatus.active ? realStatus.device_id : ''
    const prev = prevDeviceRef.current
    if (prev !== undefined && prev !== curId) {
      if (realStatus.active) {
        notify(`Now playing on ${realStatus.device_name}`, { variant: 'info' })
      } else {
        notify('Nothing is playing. Pick a device or start Spotify', { variant: 'info' })
      }
    }
    prevDeviceRef.current = curId
  }, [realStatus, notify])

  const onPickDevice = useCallback(
    (d: ConnectDevice) => {
      setDeviceMenuOpen(false)
      notify(`Switching to ${d.name}...`, { variant: 'info' })
      void transferToDevice(d.id).catch((err) => {
        console.warn('transfer failed', err)
        notify(`Couldn't switch to ${d.name}`, { variant: 'error' })
      })
    },
    [notify],
  )

  const settings = useSettings()
  const showLyricsReal = settings.showLyrics
  const artSize = artSizeFor(settings.uiScalePct)
  const heroArtSize = heroArtSizeFor(settings.uiScalePct)
  const [menuOpenReal, setMenuOpen] = useState(false)
  const [powerMenuOpenReal, setPowerMenuOpen] = useState(false)
  const [settingsOpenReal, setSettingsOpen] = useState(false)
  const [btMenuOpenReal, setBtMenuOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  // support report id dialog
  const [reportId, setReportId] = useState<string | null>(null)
  const [offlineMethod, setOfflineMethod] = useState<'chooser' | 'bluetooth' | 'pc'>('chooser')
  const [setupOverride, setSetupOverride] = useState(false)
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
  const [bootStuck, setBootStuck] = useState(false)
  useEffect(() => {
    setBootStuck(false)
    const t = window.setTimeout(() => setBootStuck(true), BOOT_STUCK_MS)
    return () => window.clearTimeout(t)
  }, [])

  // if something goes wrong change the text to try restarting
  // TODO: maybe not needed at this point since some further changes while developing the bluetooth flow showed this was not an issue as i thought
  const LOAD_STUCK_MS = 30000
  const [loadStuck, setLoadStuck] = useState(false)
  useEffect(() => {
    setLoadStuck(false)
    const t = window.setTimeout(() => setLoadStuck(true), LOAD_STUCK_MS)
    return () => window.clearTimeout(t)
  }, [])

  // reset the "set up a different connection" override once we online again
  useEffect(() => {
    if (online === true) setSetupOverride(false)
  }, [online])

  // were we ever online? shows first time setup or wifi dropped
  const [wasOnline, setWasOnline] = useState(false)
  useEffect(() => {
    if (online === true) setWasOnline(true)
  }, [online])

  const { forced, setForced } = useDevScreen()

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
  const [spotifyStuck, setSpotifyStuck] = useState(false)
  useEffect(() => {
    if (!splashOnlineStuck) {
      setSpotifyStuck(false)
      return
    }
    const t = window.setTimeout(() => setSpotifyStuck(true), SPOTIFY_STUCK_MS)
    return () => window.clearTimeout(t)
  }, [splashOnlineStuck])

  // hold the last now-playing through any small drops in network
  const [heldStatus, setHeldStatus] = useState<ObserverStatusActive | null>(null)
  useEffect(() => {
    if (realStatus?.active) setHeldStatus(realStatus)
  }, [realStatus])

  const connecting =
    online === false && (carriers?.bt === true || btConnectedDevice != null || heldStatus != null)
  const connMilestone = `${carriers?.bt === true}|${btConnectedDevice?.address ?? ''}|${heldStatus != null}`
  const OFFLINE_GRACE_MS = 6000
  const [graceElapsed, setGraceElapsed] = useState(false)
  useEffect(() => {
    if (!connecting) {
      setGraceElapsed(true)
      return
    }
    setGraceElapsed(false)
    const t = window.setTimeout(() => setGraceElapsed(true), OFFLINE_GRACE_MS)
    return () => window.clearTimeout(t)
  }, [connecting, connMilestone])

  // small drops while the phone is still reachable
  let dropReason: ReconnectReason | null = null
  if (!forced && heldStatus && realStatus?.active !== true && online === true) {
    if (!connected) {
      dropReason = 'ws'
    } else if (realStatus && !realStatus.active && realStatus.message === 'starting up') {
      dropReason = 'dealer'
    }
  }
  const reconnecting = dropReason !== null

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
  const menuOpen = forced === 'menu' ? true : menuOpenReal
  const powerMenuOpen = forced === 'power-menu' ? true : powerMenuOpenReal
  const btMenuOpen = forced === 'bluetooth-menu' ? true : btMenuOpenReal
  const settingsOpen = forced === 'settings' ? true : settingsOpenReal
  const pairing =
    forced === 'pairing' ? { address: 'AB:CD:EF:01:23:45', passkey: '123456' } : realPairing

  const OFFLINE_HOLDOFF_MS = 10000
  const [offlineHeld, setOfflineHeld] = useState(false)
  useEffect(() => {
    if (online !== false) {
      setOfflineHeld(false)
      return
    }
    const t = window.setTimeout(() => setOfflineHeld(true), OFFLINE_HOLDOFF_MS)
    return () => window.clearTimeout(t)
  }, [online])
  const offlineConfirmed = online === false && (offlineHeld || !wasOnline)

  const offlineActive =
    !forced && !reconnecting && (offlineConfirmed || (bootStuck && online !== true))
  // hold a brief "checking connection"
  const offlineChecking = offlineActive && connecting && !graceElapsed
  const onOfflineSetup = offlineActive

  // which offline screen wins
  let offlineScreen:
    'checking' | 'tethering' | 'reconnecting' | 'chooser' | 'pc' | 'bluetooth' | null = null
  if (offlineActive) {
    if (offlineChecking) {
      offlineScreen = 'checking'
    } else if (btConnectedDevice && !setupOverride) {
      // phone is connected but no internet -> "turn on tethering"
      offlineScreen = 'tethering'
    } else if ((hasKnownDevice || wasOnline) && !setupOverride) {
      offlineScreen = 'reconnecting'
    } else {
      offlineScreen = offlineMethod
    }
  }

  // discoverable while the Bluetooth pairing screen is up
  const pairingScreenShown = forced === 'needs-network' || offlineScreen === 'bluetooth'
  useEffect(() => {
    if (btMenuOpen) return
    if (!pairingScreenShown) {
      void setDiscoverable(false).catch(() => {})
      return
    }
    let cancelled = false
    const assertOn = () => {
      if (!cancelled) void setDiscoverable(true).catch(() => {})
    }
    assertOn()
    const id = window.setInterval(assertOn, 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [pairingScreenShown, btMenuOpen, setDiscoverable])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    if (forced === 'menu') setForced('playing-lyrics')
  }, [forced, setForced])

  const closePowerMenu = useCallback(() => {
    setPowerMenuOpen(false)
    if (forced === 'power-menu') setForced('playing-lyrics')
  }, [forced, setForced])

  const onSleep = useCallback(() => {
    closePowerMenu()
    void suspendDevice().catch(() => {})
  }, [closePowerMenu])

  // hardware back button
  const goBack = useCallback(() => {
    if (reportId) {
      setReportId(null)
      return
    }
    if (debugOpen) {
      setDebugOpen(false)
      return
    }
    if (deviceMenuOpen) {
      setDeviceMenuOpen(false)
      return
    }
    if (btMenuOpen) {
      setBtMenuOpen(false)
      return
    }
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }
    if (powerMenuOpen) {
      closePowerMenu()
      return
    }
    if (menuOpen) {
      closeMenu()
      return
    }
    if (onOfflineSetup && offlineMethod !== 'chooser') {
      setOfflineMethod('chooser')
      return
    }
    // back out of the chooser the reconnecting screen pushed us into
    if (onOfflineSetup && setupOverride) {
      setSetupOverride(false)
      return
    }
    // nothing to go back to
  }, [
    reportId,
    debugOpen,
    deviceMenuOpen,
    btMenuOpen,
    settingsOpen,
    powerMenuOpen,
    closePowerMenu,
    menuOpen,
    closeMenu,
    onOfflineSetup,
    offlineMethod,
    setupOverride,
  ])

  const controls = usePlayerControls({
    status: status && status.active ? status : null,
    play,
    pause,
    next,
    prev,
    seek,
    setShuffle,
    setRepeat,
    onCommandError: (message) => notify(message, { variant: 'error' }),
  })

  const savableStatus = status && status.active ? status : reconnecting ? heldStatus : null
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
  const openDebug = useCallback(() => setDebugOpen(true), [])

  const hardware = useHardwareButtons({
    status: status && status.active ? status : null,
    onPlayPause: onHardwarePlayPause,
    setVolume,
    playContext,
    onBack: goBack,
    onTogglePowerMenu: () => setPowerMenuOpen((v) => !v),
    onSleep,
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

  const globalOverlays = (
    <>
      <VolumeOverlay state={hardware.volumeOverlay} />
      <PowerMenu open={powerMenuOpen} onClose={closePowerMenu} />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        phoneVolume={status !== null && status.active === true && status.volume_disabled === true}
      />
      {deviceMenuOpen ? (
        <DevicePicker
          devices={connectDevices}
          onSelect={onPickDevice}
          placement="modal"
          onClose={() => setDeviceMenuOpen(false)}
        />
      ) : null}
      {btMenuOpen ? <BluetoothMenu online={online} onClose={() => setBtMenuOpen(false)} /> : null}
      <DebugScreen open={debugOpen} onClose={() => setDebugOpen(false)} onReport={setReportId} />
      {pairing ? <PairingDialog passkey={pairing.passkey} address={pairing.address} /> : null}
      {reportId ? <ReportDialog id={reportId} onDismiss={() => setReportId(null)} /> : null}
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
  if (forced === 'boot-splash') {
    return (
      <div className={styles.app}>
        <BootSplash />
        {globalOverlays}
      </div>
    )
  }
  if (forced === 'debug') {
    return (
      <div className={styles.app}>
        <DebugScreen open onClose={() => setForced(null)} onReport={setReportId} />
        {reportId ? <ReportDialog id={reportId} onDismiss={() => setReportId(null)} /> : null}
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

  if (!forced) {
    if (offlineScreen !== null) {
      let screen
      switch (offlineScreen) {
        case 'checking':
          screen = <ReconnectingScreen phase="checking" deviceName={topKnownDeviceName} />
          break
        case 'tethering':
          screen = <NeedsNetwork />
          break
        case 'reconnecting':
          screen = (
            <ReconnectingScreen
              phase="reconnecting"
              deviceName={topKnownDeviceName}
              carriers={carriers}
              trouble={btTrouble}
              onSetUpOther={() => setSetupOverride(true)}
            />
          )
          break
        case 'pc':
          screen = <PcConnect />
          break
        case 'bluetooth':
          screen = <NeedsNetwork />
          break
        default:
          screen = (
            <ConnectionChooser
              onPickPc={() => setOfflineMethod('pc')}
              onPickBluetooth={() => setOfflineMethod('bluetooth')}
            />
          )
      }
      return (
        <div className={styles.app}>
          {screen}
          {globalOverlays}
        </div>
      )
    }

    if (auth.required && auth.url) {
      return (
        <>
          <AuthScreen url={auth.url} />
          {globalOverlays}
        </>
      )
    }

    if (spotifyStuck && splashOnlineStuck && !reconnecting) {
      return (
        <div className={styles.app}>
          <ReconnectingScreen phase="spotify-unreachable" />
          {globalOverlays}
        </div>
      )
    }

    // used to hide the starting up screen on first boot after a sucessful bluetooth pairing with pan
    if (
      !reconnecting &&
      online === true &&
      auth.loading &&
      !auth.url &&
      (!status || !status.active)
    ) {
      const preAuthHint = loadStuck
        ? 'Still fetching from Spotify if this persists, try unplugging and replugging.'
        : undefined
      return (
        <>
          <AuthScreen hint={preAuthHint} />
          {globalOverlays}
        </>
      )
    }

    // the daemon reports "starting up" while the dealer is (re)connecting
    if (
      !reconnecting &&
      ((loading && !status) || (auth.loading && (!status || !status.active)) || playerStartingUp)
    ) {
      const stuckHint =
        loadStuck && online === true && !auth.url
          ? 'Still connecting to Spotify if this persists for another minute, try unplugging and replugging.'
          : undefined
      return (
        <div className={styles.app}>
          <BootSplash caption="starting up" hint={stuckHint} />
          {globalOverlays}
        </div>
      )
    }

    // "setting things up" during the FIRST-EVER boot to fetch a library catalog
    if (!reconnecting && status?.setting_up) {
      return (
        <div className={styles.app}>
          <BootSplash caption="setting things up" />
          {globalOverlays}
        </div>
      )
    }

    if (!reconnecting && (!status || !status.active)) {
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
    }
  }

  // live status when active otherwise the last playing
  const playerStatus = status && status.active ? status : reconnecting ? heldStatus : null
  if (!playerStatus || !playerStatus.active) return null
  const isPodcast = playerStatus.track_uri.startsWith('spotify:episode:')

  // noti over the player on a network drops
  const bannerReason: ReconnectReason | null =
    forced === 'reconnect-banner' ? 'offline' : reconnecting ? dropReason : null

  return (
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
            <div className={`${styles.left} ${controls.transitioning ? styles.transitioning : ''}`}>
              <AlbumArt src={playerStatus.track_image} size={artSize} />
              <TrackInfo trackName={playerStatus.track_name} artist={playerStatus.track_artist} />
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
          showSave={!isPodcast}
          saved={liked.saved}
          onToggleSaved={liked.toggle}
          onPrev={controls.onPrev}
          onNext={controls.onNext}
          onPlayPause={controls.onPlayPause}
          onToggleShuffle={controls.onToggleShuffle}
          onCycleRepeat={controls.onCycleRepeat}
          onRewind15={() => seekRelative(-15000)}
          onForward15={() => seekRelative(15000)}
          onMore={() => setMenuOpen(true)}
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
          setMenuOpen(false)
          setDeviceMenuOpen(true)
        }}
        onOpenBluetooth={() => {
          setMenuOpen(false)
          setBtMenuOpen(true)
        }}
        onOpenSettings={() => {
          setMenuOpen(false)
          setSettingsOpen(true)
        }}
      />

      {globalOverlays}
    </div>
  )
}
