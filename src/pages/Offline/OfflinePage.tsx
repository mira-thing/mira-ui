import { ConnectionChooser } from '@/components/ConnectionChooser'
import { NeedsNetwork } from '@/components/NeedsNetwork'
import { PcConnect } from '@/components/PcConnect'
import { ReconnectingScreen } from '@/components/ReconnectingScreen'
import type { OfflineMethod } from '@/hooks/useOfflineScreen'
import type { OfflineScreen } from '@/app/routes'
import type { BtTroubleHint, Carriers } from '@/hooks/useBluetooth'

export interface OfflinePageProps {
  screen: OfflineScreen
  /** the phone we would reconnect to, named so the screen can say which */
  deviceName: string | null
  carriers: Carriers | null
  trouble: BtTroubleHint
  onSetUpOther: () => void
  onPickMethod: (method: OfflineMethod) => void
}

/**
 * What the user sees while the daemon has no internet. Which of these is right
 * is `resolveOfflineScreen`'s call; this only draws the one it picked.
 */
export function OfflinePage({
  screen,
  deviceName,
  carriers,
  trouble,
  onSetUpOther,
  onPickMethod,
}: OfflinePageProps) {
  switch (screen) {
    case 'checking':
      return <ReconnectingScreen phase="checking" deviceName={deviceName} />
    case 'tethering':
      return <NeedsNetwork />
    case 'reconnecting':
      return (
        <ReconnectingScreen
          phase="reconnecting"
          deviceName={deviceName}
          carriers={carriers}
          trouble={trouble}
          onSetUpOther={onSetUpOther}
        />
      )
    case 'pc':
      return <PcConnect />
    case 'bluetooth':
      return <NeedsNetwork />
    default:
      return (
        <ConnectionChooser
          onPickPc={() => onPickMethod('pc')}
          onPickBluetooth={() => onPickMethod('bluetooth')}
        />
      )
  }
}
