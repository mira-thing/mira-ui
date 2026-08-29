import { useCallback, useEffect, useRef } from 'react'
import { transferToDevice } from '@/api/client'
import type { ConnectDevice, ObserverStatus } from '@/api/types'
import type { NotifyFn } from '@/notify/notifyContext'

export interface UseDeviceSwitchParams {
  status: ObserverStatus | null
  notify: NotifyFn
  /** the device menu, which a pick closes on the way out */
  onPicked: () => void
}

/**
 * Moving playback between Connect devices, and saying so when it moves.
 *
 * The device can be handed off from the phone as easily as from here, so the
 * announcement watches the reported device rather than the transfers we
 * started — otherwise a handoff from elsewhere looks like nothing happened.
 */
export function useDeviceSwitch({
  status,
  notify,
  onPicked,
}: UseDeviceSwitchParams): (device: ConnectDevice) => void {
  const prevDeviceRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (status == null) return
    const current = status.active ? status.device_id : ''
    const previous = prevDeviceRef.current
    // undefined means this is the first status of the session, which is not a
    // change worth announcing
    if (previous !== undefined && previous !== current) {
      if (status.active) {
        notify(`Now playing on ${status.device_name}`, { variant: 'info' })
      } else {
        notify('Nothing is playing. Pick a device or start Spotify', { variant: 'info' })
      }
    }
    prevDeviceRef.current = current
  }, [status, notify])

  return useCallback(
    (device: ConnectDevice) => {
      onPicked()
      notify(`Switching to ${device.name}...`, { variant: 'info' })
      void transferToDevice(device.id).catch((err) => {
        console.warn('transfer failed', err)
        notify(`Couldn't switch to ${device.name}`, { variant: 'error' })
      })
    },
    [notify, onPicked],
  )
}
