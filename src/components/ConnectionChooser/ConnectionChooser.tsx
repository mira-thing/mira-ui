import { memo } from 'react'
import { Icon } from '@/ui/icons'
import styles from './ConnectionChooser.module.scss'

interface Props {
  onPickPc: () => void
  onPickBluetooth: () => void
}

// when no internet is present we show these options
// TODO: bluetooth descoverablilty should only be set when the bluetooth screen is shown
function ConnectionChooserImpl({ onPickPc, onPickBluetooth }: Props) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Choose a connection method</h1>

      <div className={styles.cards}>
        <button type="button" className={styles.card} onClick={onPickPc} aria-label="Connect to PC">
          <span className={styles.iconWrap} aria-hidden>
            <Icon name="computer" size={56} />
          </span>
          <span className={styles.cardLabel}>Connect to PC</span>
        </button>

        <button
          type="button"
          className={styles.card}
          onClick={onPickBluetooth}
          aria-label="Connect with Bluetooth"
        >
          <span className={styles.iconWrap} aria-hidden>
            <Icon name="bluetoothLarge" size={56} />
          </span>
          <span className={styles.cardLabel}>Connect with Bluetooth</span>
        </button>
      </div>
    </div>
  )
}

export const ConnectionChooser = memo(ConnectionChooserImpl)
