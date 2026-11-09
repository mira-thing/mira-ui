import { memo } from 'react'
import { Layer } from '@/input/router'
import { useKnobScope } from '@/input/useKnobScope'
import styles from './PairingDialog.module.scss'

interface Props {
  passkey: string
  address: string
}

function PairingDialogImpl({ passkey, address }: Props) {
  useKnobScope({ layer: Layer.system, enabled: true, onStep: () => true, onSelect: () => true })

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <div className={styles.title}>Pair this device?</div>
        <div className={styles.subtitle}>
          Check that this code matches the one on your phone, then tap <strong>Pair</strong> on your
          phone.
        </div>
        <div className={styles.passkey}>{passkey}</div>
        <div className={styles.address}>{address}</div>
        <div className={styles.waitingRow} aria-live="polite">
          <span className={styles.pulseDot} aria-hidden />
          <span className={styles.waitingLabel}>Waiting for your phone...</span>
        </div>
      </div>
    </div>
  )
}

export const PairingDialog = memo(PairingDialogImpl)
