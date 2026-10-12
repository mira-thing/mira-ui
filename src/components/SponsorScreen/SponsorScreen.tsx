import { memo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { BRAND_NAME } from '@/brand'
import { Icon } from '@/ui/icons'
import { useUiScale } from '@/uiScale'
import styles from './SponsorScreen.module.scss'

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
                <Icon name="heart" size={36} />
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
