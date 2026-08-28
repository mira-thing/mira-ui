import { memo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { BRAND_NAME } from '@/brand'
import { useUiScale } from '@/uiScale'
import styles from './SponsorScreen.module.scss'

function HeartIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

export const SPONSOR_URL = 'https://github.com/mira-thing/mira-releases#support'

interface Props {
  onClose: () => void
}

function SponsorScreenImpl({ onClose }: Props) {
  const zoom = useUiScale()
  const qrSize = zoom > 1 ? Math.round(220 / zoom) : 220
  return (
    <div className={styles.container}>
      <div className={styles.main}>
        <div className={styles.card}>
          <div className={styles.qrWrap}>
            <QRCodeSVG
              value={SPONSOR_URL}
              size={qrSize}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
              marginSize={2}
            />
          </div>
          <div className={styles.text}>
            <div className={styles.titleRow}>
              <span className={styles.title}>Enjoying {BRAND_NAME}?</span>
              <span className={styles.heart} aria-hidden>
                <HeartIcon size={36} />
              </span>
            </div>
            <p className={styles.body}>
              {BRAND_NAME} is free, open source, and made by two people in their spare time. If it
              brought your Car Thing back to life, you can help keep it going.
            </p>
            <p className={styles.perks}>
              Sponsors get <strong>early access to betas</strong> and{' '}
              <strong>access to the dev chat</strong>.
            </p>
            <div className={styles.fallback}>
              <div className={styles.fallbackLabel}>Scan the QR or visit</div>
              <div className={styles.fallbackUrl}>
                github.com/
                <wbr />
                mira-thing/
                <wbr />
                mira-releases#support
              </div>
            </div>
            <div className={styles.note}>
              Don't worry, this is the only place we ever ask. Enjoy {BRAND_NAME}.
            </div>
          </div>
        </div>
      </div>
      <div className={styles.dismissWrap}>
        <button type="button" className={styles.dismiss} onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  )
}

export const SponsorScreen = memo(SponsorScreenImpl)
