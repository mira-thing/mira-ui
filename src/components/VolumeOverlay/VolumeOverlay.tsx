import { useEffect } from 'react'
import { useOverlayActivity } from '@/notify/notifyContext'
import type { VolumeOverlayState } from '@/hooks/useHardwareButtons'
import { Icon, type IconName } from '@/ui/icons'
import styles from './VolumeOverlay.module.scss'

function volumeIcon(level: number): IconName {
  if (level <= 0.001) return 'volumeMuted'
  if (level <= 0.33) return 'volumeLow'
  if (level <= 0.66) return 'volumeMedium'
  return 'volumeHigh'
}

export function VolumeOverlay({ state }: { state: VolumeOverlayState }) {
  const clamped = Math.max(0, Math.min(1, state.value))
  const { setVolumeVisible } = useOverlayActivity()
  useEffect(() => {
    setVolumeVisible(state.visible)
    return () => setVolumeVisible(false)
  }, [state.visible, setVolumeVisible])

  // cant show the direct volume level so we show the direction
  if (state.phone) {
    return (
      <div
        className={`${styles.overlay} ${state.visible ? styles.visible : ''}`}
        aria-hidden={!state.visible}
      >
        <span className={styles.icon}>
          <Icon name={volumeIcon(state.dir === -1 ? 0.2 : 1)} size={20} />
        </span>
        <span className={styles.label}>
          {state.dir === -1 ? 'Phone volume -' : 'Phone volume +'}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`${styles.overlay} ${state.visible ? styles.visible : ''} ${
        state.disabled ? styles.disabled : ''
      }`}
      aria-hidden={!state.visible}
    >
      <span className={styles.icon}>
        <Icon name={state.disabled ? 'lock' : volumeIcon(clamped)} size={20} />
      </span>
      <div className={styles.track}>
        <div className={styles.fill} style={{ transform: `scaleX(${clamped})` }} />
      </div>
      {state.disabled && <span className={styles.label}>On device</span>}
    </div>
  )
}
