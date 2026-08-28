import { memo, useEffect, useState } from 'react'
import { BRAND_NAME } from '@/brand'
import styles from './CheckinConsent.module.scss'

interface Props {
  onChoose: (consent: 'granted' | 'denied') => void
}

function CheckinConsentImpl({ onChoose }: Props) {
  const [sel, setSel] = useState<0 | 1>(0)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onChoose(sel === 0 ? 'granted' : 'denied')
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onWheel = (e: WheelEvent) => {
      const d = e.deltaX !== 0 ? e.deltaX : e.deltaY
      if (d === 0) return
      e.preventDefault()
      e.stopPropagation()
      setSel(d > 0 ? 1 : 0)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [sel, onChoose])

  return (
    <div className={styles.container} role="dialog" aria-label="Device count">
      <div className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>One quick thing</h1>
          <p className={styles.body}>
            {BRAND_NAME} counts how many devices are out there. A few times a day, your Car Thing
            sends a tiny anonymous ping. One way, with a hashed device identifier and the firmware
            version. No account, no listening data, ever. It just tells me {BRAND_NAME} is alive and
            worth improving.
          </p>
        </div>
      </div>
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary} ${sel === 0 ? styles.btnFocus : ''}`}
          onClick={() => onChoose('granted')}
        >
          Sounds good
        </button>
        <button
          type="button"
          className={`${styles.btn} ${sel === 1 ? styles.btnFocus : ''}`}
          onClick={() => onChoose('denied')}
        >
          No thanks
        </button>
      </div>
    </div>
  )
}

export const CheckinConsent = memo(CheckinConsentImpl)
