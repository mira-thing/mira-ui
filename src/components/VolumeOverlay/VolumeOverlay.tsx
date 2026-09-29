import { useEffect } from 'react'
import { useOverlayActivity } from '@/notify/notifyContext'
import type { VolumeOverlayState } from '@/hooks/useHardwareButtons'
import styles from './VolumeOverlay.module.scss'

// icons to represent different volume levels
const VOL_MUTED = [
  'M13.86 5.47a.75.75 0 0 0-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 0 0 8.8 6.53L10.269 8l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06L12.39 8l1.47-1.47a.75.75 0 0 0 0-1.06z',
  'M10.116 1.5A.75.75 0 0 0 8.991.85l-6.925 4a3.64 3.64 0 0 0-1.33 4.967 3.64 3.64 0 0 0 1.33 1.332l6.925 4a.75.75 0 0 0 1.125-.649v-1.906a4.7 4.7 0 0 1-1.5-.694v1.3L2.817 9.852a2.14 2.14 0 0 1-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694z',
]
const VOL_LOW = [
  'M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88',
]
const VOL_MED = [
  'M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 6.087a4.502 4.502 0 0 0 0-8.474v1.65a3 3 0 0 1 0 5.175z',
]
const VOL_HIGH = [
  'M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88',
  'M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z',
]

function VolumeIcon({ level }: { level: number }) {
  const paths =
    level <= 0.001 ? VOL_MUTED : level <= 0.33 ? VOL_LOW : level <= 0.66 ? VOL_MED : VOL_HIGH
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} fillRule="evenodd" clipRule="evenodd" d={d} />
      ))}
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="9" rx="2" fill="currentColor" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
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
          <VolumeIcon level={state.dir === -1 ? 0.2 : 1} />
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
        {state.disabled ? <LockIcon /> : <VolumeIcon level={clamped} />}
      </span>
      <div className={styles.track}>
        <div className={styles.fill} style={{ transform: `scaleX(${clamped})` }} />
      </div>
      {state.disabled && <span className={styles.label}>On device</span>}
    </div>
  )
}
