import { memo, useEffect, useState } from 'react'
import { resetDevice, restartDevice, suspendDevice } from '@/api/system'
import { BRAND_NAME } from '@/brand'
import { Icon } from '@/ui/icons'
import styles from './PowerMenu.module.scss'

interface Props {
  open: boolean
  onClose: () => void
  onSupport?: () => void
}

// power menu
function PowerMenuImpl({ open, onClose, onSupport }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState<'sleep' | 'restart' | 'reset' | null>(null)

  useEffect(() => {
    if (!open) {
      setConfirmReset(false)
      setBusy(null)
    }
  }, [open])

  const onSleep = () => {
    if (busy) return
    setBusy('sleep')
    void suspendDevice().catch(() => {})
    // screen goes dark
    onClose()
  }

  const onRestart = () => {
    if (busy) return
    setBusy('restart')
    void restartDevice().catch(() => setBusy(null))
    // leave busy true on success
  }

  const onConfirmReset = () => {
    if (busy) return
    setBusy('reset')
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
    void resetDevice().catch(() => setBusy(null))
  }

  return (
    <div
      className={`${styles.root} ${open ? styles.open : ''}`}
      aria-hidden={!open}
      onClick={onClose}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmReset ? (
          <div className={styles.confirm}>
            <div className={styles.confirmTitle}>Reset device?</div>
            <div className={styles.confirmBody}>
              This forgets your Spotify sign-in and all paired phones, then restarts. You'll need to
              pair and sign in again.
            </div>
            <div className={styles.confirmButtons}>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.secondary}`}
                onClick={() => setConfirmReset(false)}
                disabled={busy === 'reset'}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.confirmDanger}`}
                onClick={onConfirmReset}
                disabled={busy === 'reset'}
              >
                {busy === 'reset' ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button type="button" className={styles.action} onClick={onSleep} disabled={!!busy}>
              <Icon name="moon" />
              <span>Sleep</span>
            </button>
            <button type="button" className={styles.action} onClick={onRestart} disabled={!!busy}>
              <Icon name="restart" />
              <span>{busy === 'restart' ? 'Restarting...' : 'Restart'}</span>
            </button>
            {onSupport ? (
              <button
                type="button"
                className={`${styles.action} ${styles.support}`}
                onClick={onSupport}
                disabled={!!busy}
              >
                <Icon name="heart" />
                <span>Support {BRAND_NAME}</span>
              </button>
            ) : null}
            <button
              type="button"
              className={`${styles.action} ${styles.danger}`}
              onClick={() => setConfirmReset(true)}
              disabled={!!busy}
            >
              <Icon name="trash" />
              <span>Reset</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export const PowerMenu = memo(PowerMenuImpl)
