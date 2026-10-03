import { memo, useEffect, useRef, useState } from 'react'
import * as bt from '@/api/bluetooth'
import { subscribeEvents } from '@/api/eventBus'
import type { DevicePairedPayload, KnownBluetoothDevice } from '@/api/types'
import { BT_DEVICE_NAME } from '@/brand'
import { useKnownDevices } from '@/hooks/useKnownDevices'
import { useNotify } from '@/notify/notifyContext'
import styles from './BluetoothMenu.module.scss'

interface Props {
  online: boolean | null
  onClose: () => void
}

const FORGET_ARM_MS = 3500

// Bluetooth pairing menu
// priority list, forget, tap to connect, pair new device
function BluetoothMenuImpl({ online, onClose }: Props) {
  const notify = useNotify()
  const { devices, refresh } = useKnownDevices(true)
  const [armedForget, setArmedForget] = useState<string | null>(null)
  const [pairMode, setPairMode] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!armedForget) return
    const t = window.setTimeout(() => setArmedForget(null), FORGET_ARM_MS)
    return () => window.clearTimeout(t)
  }, [armedForget])

  // pair mode sets discoverable on
  const pairModeRef = useRef(pairMode)
  const onlineRef = useRef(online)
  useEffect(() => {
    pairModeRef.current = pairMode
    onlineRef.current = online
  })

  useEffect(() => {
    return () => {
      if (pairModeRef.current && onlineRef.current === true) {
        bt.setDiscoverable(false).catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    if (!pairMode) return
    const id = window.setInterval(() => {
      bt.setDiscoverable(true).catch(() => {})
    }, 3000)
    return () => window.clearInterval(id)
  }, [pairMode])

  // a successful pair completes pair mode
  useEffect(() => {
    return subscribeEvents((evt) => {
      if (evt.type !== 'bluetooth/paired' || !pairModeRef.current) return
      const p = evt.data as DevicePairedPayload
      const label = p?.device?.alias || p?.device?.name || p?.device?.address
      notify(label ? `Paired ${label}` : 'Paired', { variant: 'success', icon: 'bluetooth' })
      setPairMode(false)
      if (onlineRef.current === true) {
        bt.setDiscoverable(false).catch(() => {})
      }
    })
  }, [notify])

  const onPairNew = () => {
    bt.setDiscoverable(true)
      .then(() => setPairMode(true))
      .catch(() => notify("Couldn't enable pairing", { variant: 'error' }))
  }

  const onToggleStar = (d: KnownBluetoothDevice) => {
    setArmedForget(null)
    bt.starDevice(d.address, !d.starred)
      .then(refresh)
      .catch(() => notify("Couldn't update priority", { variant: 'error' }))
  }

  const onForget = (d: KnownBluetoothDevice) => {
    // dontt let the user delete the only bt device
    const onlyDevice = (devices?.length ?? 0) === 1
    const wouldStrand = onlyDevice && (online !== true || d.network)
    if (wouldStrand) {
      setArmedForget(null)
      notify(
        "That's your only connection! Plug in over USB or pair another phone before removing it",
        { variant: 'warning' },
      )
      return
    }
    if (armedForget !== d.address) {
      setArmedForget(d.address)
      return
    }
    setArmedForget(null)
    setBusy(d.address)
    bt.forgetDevice(d.address)
      .then(() => {
        notify(`Removed ${deviceLabel(d)}`, { variant: 'info', icon: 'bluetooth' })
        refresh()
      })
      .catch(() => notify(`Couldn't remove ${deviceLabel(d)}`, { variant: 'error' }))
      .finally(() => setBusy(null))
  }

  // a device is set when it carries the active PAN and we are online
  const isSettled = (d: KnownBluetoothDevice) => d.network && online !== false

  const stateLabel = (d: KnownBluetoothDevice) => {
    if (isSettled(d)) return 'Connected'
    if (d.connected) return 'Connected with no internet · tap to use'
    return 'Tap to connect'
  }

  const onConnect = (d: KnownBluetoothDevice) => {
    setArmedForget(null)
    if (isSettled(d)) return
    notify(`Connecting to ${deviceLabel(d)}...`, { variant: 'info', icon: 'bluetooth' })
    bt.connectKnownDevice(d.address).catch(() =>
      notify(`Couldn't connect to ${deviceLabel(d)}`, { variant: 'error' }),
    )
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>Bluetooth Pairing</div>

        {devices !== null && devices.length === 0 ? (
          <div className={styles.empty}>
            <div>No phones paired yet.</div>
            <div className={styles.emptySub}>
              If a phone you removed won't pair again, also remove "{BT_DEVICE_NAME}" from that
              phone's Bluetooth settings, then try again.
            </div>
          </div>
        ) : (
          <ul className={styles.list}>
            {(devices ?? []).map((d) => (
              <li key={d.address} className={styles.row}>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${d.starred ? styles.starOn : ''}`}
                  aria-label={d.starred ? 'Remove priority' : 'Make priority'}
                  aria-pressed={d.starred}
                  onClick={() => onToggleStar(d)}
                >
                  <StarIcon filled={d.starred} />
                </button>

                <div
                  className={`${styles.info} ${isSettled(d) ? '' : styles.connectable}`}
                  role={isSettled(d) ? undefined : 'button'}
                  tabIndex={isSettled(d) ? undefined : 0}
                  onClick={() => onConnect(d)}
                >
                  <span className={styles.name}>{deviceLabel(d)}</span>
                  <span
                    className={`${styles.state} ${
                      isSettled(d) ? styles.stateOn : d.connected ? styles.stateWarn : ''
                    }`}
                  >
                    {stateLabel(d)}
                  </span>
                </div>

                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.forgetBtn} ${
                    armedForget === d.address ? styles.forgetArmed : ''
                  }`}
                  aria-label={armedForget === d.address ? 'Tap again to remove' : 'Remove device'}
                  disabled={busy === d.address}
                  onClick={() => onForget(d)}
                >
                  {armedForget === d.address ? (
                    <span className={styles.forgetConfirm}>Remove?</span>
                  ) : (
                    <TrashIcon />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {pairMode ? (
          <div className={styles.pairHint}>
            <span className={styles.pulseDot} aria-hidden />
            Discoverable as "{BT_DEVICE_NAME}" pair from your phone's Bluetooth settings
          </div>
        ) : (
          <button type="button" className={styles.pairBtn} onClick={onPairNew}>
            <PlusIcon />
            <span>Pair new device</span>
          </button>
        )}
      </div>
    </div>
  )
}

function deviceLabel(d: KnownBluetoothDevice): string {
  return d.name || d.address
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.9 6.05 6.6.72-4.9 4.49 1.34 6.52L12 17l-5.94 3.28 1.34-6.52-4.9-4.49 6.6-.72L12 2.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 7h12M9 7V5h6v2M7 7l1 12h8l1-12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export const BluetoothMenu = memo(BluetoothMenuImpl)
