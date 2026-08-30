import { BluetoothMenu } from '@/components/BluetoothMenu'
import { CheckinConsent } from '@/components/CheckinConsent'
import { DebugScreen } from '@/components/DebugScreen'
import { DevicePicker } from '@/components/DevicePicker'
import { PairingDialog } from '@/components/PairingDialog'
import { PowerMenu } from '@/components/PowerMenu'
import { ReportDialog } from '@/components/ReportDialog'
import { Screensaver } from '@/components/Screensaver'
import { SettingsSheet } from '@/components/SettingsSheet'
import { SponsorScreen } from '@/components/SponsorScreen'
import { UpdateCard } from '@/components/UpdateCard'
import { VolumeOverlay } from '@/components/VolumeOverlay'
import type { VolumeOverlayState } from '@/hooks/useHardwareButtons'
import type { PairingPrompt } from '@/hooks/useBluetooth'
import type { ConnectDevice } from '@/api/types'
import { useOverlayState } from './overlayContext'

export interface UpdateOfferProps {
  latest: string
  highlights: string[]
  mandatory: boolean
  onSkip: () => void
}

export interface OverlayHostProps {
  volumeOverlay: VolumeOverlayState
  /** the phone owns the volume, so the sheet says so instead of offering a slider */
  phoneVolume: boolean
  online: boolean | null
  connectDevices: ConnectDevice[]
  onPickDevice: (device: ConnectDevice) => void
  pairing: PairingPrompt | null
  /** something already owns the screen; the consent card waits its turn */
  busy: boolean
  onChooseConsent: (consent: 'granted' | 'denied') => void
  update: UpdateOfferProps
  screensaverArt: string | null
  utcOffsetMin: number | null
}

/**
 * Every overlay that can cover any screen, rendered once. Which of them are up
 * is `useOverlays`' business; this only draws them.
 */
export function OverlayHost({
  volumeOverlay,
  phoneVolume,
  online,
  connectDevices,
  onPickDevice,
  pairing,
  busy,
  onChooseConsent,
  update,
  screensaverArt,
  utcOffsetMin,
}: OverlayHostProps) {
  const overlays = useOverlayState()

  return (
    <>
      <VolumeOverlay state={volumeOverlay} />
      <PowerMenu
        open={overlays.isOpen('powerMenu')}
        onClose={() => overlays.close('powerMenu')}
        onSupport={() => {
          overlays.close('powerMenu')
          overlays.open('sponsor')
        }}
      />
      <SettingsSheet
        open={overlays.isOpen('settings')}
        onClose={() => overlays.close('settings')}
        phoneVolume={phoneVolume}
      />
      {overlays.isOpen('deviceMenu') ? (
        <DevicePicker
          devices={connectDevices}
          onSelect={onPickDevice}
          placement="modal"
          onClose={() => overlays.close('deviceMenu')}
        />
      ) : null}
      {overlays.isOpen('btMenu') ? (
        <BluetoothMenu online={online} onClose={() => overlays.close('btMenu')} />
      ) : null}
      <DebugScreen
        open={overlays.isOpen('debug')}
        onClose={() => overlays.close('debug')}
        onReport={overlays.openReport}
      />
      {pairing ? <PairingDialog passkey={pairing.passkey} address={pairing.address} /> : null}
      {overlays.reportId ? (
        <ReportDialog id={overlays.reportId} onDismiss={() => overlays.close('report')} />
      ) : null}
      {overlays.isOpen('sponsor') ? (
        <SponsorScreen onClose={() => overlays.close('sponsor')} />
      ) : null}
      {overlays.isOpen('consent') && !busy ? <CheckinConsent onChoose={onChooseConsent} /> : null}
      {overlays.isOpen('updateCard') ? (
        <UpdateCard
          latest={update.latest}
          highlights={update.highlights}
          mandatory={update.mandatory}
          onRemindLater={overlays.remindLater}
          onSkip={update.onSkip}
        />
      ) : null}
      {overlays.isOpen('screensaver') ? (
        <Screensaver
          artUrl={screensaverArt}
          utcOffsetMin={utcOffsetMin}
          onClose={() => overlays.close('screensaver')}
        />
      ) : null}
    </>
  )
}
