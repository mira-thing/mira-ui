import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { SaveFilledIcon, SaveOutlineIcon } from './icons'
import styles from './SaveButton.module.scss'

interface Props {
  saved: boolean
  onToggle?: () => void
  disabled?: boolean
}

const ANIM_MS = 420

const CONFETTI = [
  { x: -52, y: -34, r: -140, s: 9, c: 0 },
  { x: -33, y: -54, r: -90, s: 7, c: 1 },
  { x: -12, y: -62, r: -40, s: 10, c: 2 },
  { x: 12, y: -64, r: 60, s: 8, c: 0 },
  { x: 34, y: -52, r: 120, s: 7, c: 1 },
  { x: 54, y: -30, r: 160, s: 9, c: 2 },
  { x: -60, y: -8, r: -170, s: 6, c: 1 },
  { x: 60, y: -6, r: 30, s: 6, c: 0 },
  { x: -22, y: -42, r: -20, s: 6, c: 2 },
  { x: 24, y: -46, r: 100, s: 7, c: 1 },
]

function SaveButtonImpl({ saved, onToggle, disabled = false }: Props) {
  // nothing to save while a narration owns the screen, and its uri is not a saveable track
  const filled = saved && !disabled
  const [animating, setAnimating] = useState(false)
  const [burst, setBurst] = useState(0)
  const timerRef = useRef(0)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const handleClick = useCallback(() => {
    setAnimating(true)
    if (!saved) setBurst((n) => n + 1)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setAnimating(false), ANIM_MS)
    onToggle?.()
  }, [onToggle, saved])

  return (
    <button
      type="button"
      className={`${styles.save} ${filled ? styles.saved : ''} ${animating ? styles.animating : ''} ${disabled ? styles.disabled : ''}`}
      aria-label={filled ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
      aria-pressed={filled}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : handleClick}
    >
      <span className={styles.icons}>
        <span className={styles.outline}>
          <SaveOutlineIcon size={36} />
        </span>
        <span className={styles.filled}>
          <SaveFilledIcon size={36} />
        </span>
      </span>
      {burst > 0 ? (
        <span className={styles.confetti} key={burst} aria-hidden>
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className={`${styles.bit} ${styles[`c${p.c}`]}`}
              style={
                {
                  width: p.s,
                  height: p.s,
                  '--x': `${p.x}px`,
                  '--y': `${p.y}px`,
                  '--r': `${p.r}deg`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      ) : null}
    </button>
  )
}

export const SaveButton = memo(SaveButtonImpl)
