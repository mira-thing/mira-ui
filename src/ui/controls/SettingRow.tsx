import type { ReactNode } from 'react'
import styles from './SettingRow.module.scss'

export interface SettingRowProps {
  icon: ReactNode
  label: string
  value: string
  /** turns the icon chip into an on/off switch, e.g. auto brightness beside its slider */
  iconSwitch?: { checked: boolean; onChange: (checked: boolean) => void; label: string }
  /** the control under the label, usually a `NotchedSlider` */
  children: ReactNode
}

export function SettingRow({ icon, label, value, iconSwitch, children }: SettingRowProps) {
  return (
    <div className={styles.row}>
      {iconSwitch ? (
        <button
          type="button"
          role="switch"
          aria-checked={iconSwitch.checked}
          aria-label={iconSwitch.label}
          className={`${styles.chip} ${styles.chipBtn} ${iconSwitch.checked ? styles.chipOn : ''}`}
          onClick={() => iconSwitch.onChange(!iconSwitch.checked)}
        >
          {icon}
        </button>
      ) : (
        <span className={styles.chip} aria-hidden>
          {icon}
        </span>
      )}
      <div className={styles.rowMain}>
        <div className={styles.rowHead}>
          <span className={styles.label}>{label}</span>
          <span className={styles.value}>{value}</span>
        </div>
        {children}
      </div>
    </div>
  )
}
