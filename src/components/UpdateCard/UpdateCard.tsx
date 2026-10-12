import { memo, useState } from 'react'
import { BRAND_NAME } from '@/brand'
import { Layer } from '@/input/router'
import { useKnobScope } from '@/input/useKnobScope'
import styles from './UpdateCard.module.scss'

const MAX_HIGHLIGHTS = 3

interface Props {
  latest: string
  highlights?: string[]
  // a mandatory release drops the skip option
  mandatory?: boolean
  onRemindLater: () => void
  onSkip?: () => void
}

function UpdateCardImpl({
  latest,
  highlights = [],
  mandatory = false,
  onRemindLater,
  onSkip,
}: Props) {
  const canSkip = !mandatory && onSkip != null
  const [sel, setSel] = useState<0 | 1>(0)

  // a mandatory card has one button, but still keeps the knob off the volume behind it
  useKnobScope({
    layer: Layer.modal,
    enabled: true,
    onStep: (dir) => {
      if (canSkip) setSel(dir > 0 ? 1 : 0)
    },
    onSelect: () => {
      if (canSkip && sel === 1) onSkip?.()
      else onRemindLater()
    },
  })

  return (
    <div className={styles.overlay} role="dialog" aria-label="Update available">
      <div className={styles.card}>
        <h1 className={styles.title}>Update available</h1>
        <p className={`${styles.body} ${styles.bodyCenter}`}>
          {BRAND_NAME} {latest} is out.
        </p>
        <div className={styles.body}>What's new</div>
        {highlights.length > 0 ? (
          <ul className={styles.highlights}>
            {highlights.slice(0, MAX_HIGHLIGHTS).map((h) => (
              <li key={h} className={styles.highlight}>
                {h}
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.hint}>
          Flash from <span className={styles.hintUrl}>terbium.app</span> on your computer
        </p>
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${!canSkip || sel === 0 ? styles.btnFocus : ''}`}
            onClick={onRemindLater}
          >
            Remind me later
          </button>
          {canSkip ? (
            <button
              type="button"
              className={`${styles.btn} ${sel === 1 ? styles.btnFocus : ''}`}
              onClick={onSkip}
            >
              Skip this version
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const UpdateCard = memo(UpdateCardImpl)
