import { memo } from 'react'
import {
  DJIcon,
  MoreIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  RepeatOneIcon,
  SeekBack15Icon,
  SeekForward15Icon,
  ShuffleIcon,
} from './icons'
import { SaveButton } from './SaveButton'
import { useNarration } from '@/hooks/useDJNarration'
import styles from './Controls.module.scss'

import type { RepeatMode } from '@/components/Menu'

interface Props {
  isPaused: boolean
  shuffle: boolean
  repeat: RepeatMode
  disallowPrev?: boolean
  disallowNext?: boolean
  // podcast mode: shuffle/repeat become rewind/forward 15s
  isPodcast?: boolean
  // dj mode: shuffle becomes the switch-set button
  isDJ?: boolean
  showSave?: boolean
  saved?: boolean
  onToggleSaved?: () => void
  onPrev?: () => void
  onPlayPause?: () => void
  onNext?: () => void
  onMore?: () => void
  onToggleShuffle?: () => void
  onDJSignal?: () => void
  onCycleRepeat?: () => void
  onRewind15?: () => void
  onForward15?: () => void
}

function ControlsImpl({
  isPaused,
  shuffle,
  repeat,
  disallowPrev = false,
  disallowNext = false,
  isPodcast = false,
  isDJ = false,
  showSave = false,
  saved = false,
  onToggleSaved,
  onPrev,
  onPlayPause,
  onNext,
  onMore,
  onToggleShuffle,
  onDJSignal,
  onCycleRepeat,
  onRewind15,
  onForward15,
}: Props) {
  const repeatActive = repeat !== 'off'
  // repeating a DJ set means nothing, so it is disabled for the whole set
  const repeatDisabled = isDJ
  // saving is meaningless while a narration owns the screen, but fine for songs inside a DJ set
  const { narrating } = useNarration()

  return (
    <div className={styles.row}>
      <div className={styles.left}>
        {showSave ? (
          <SaveButton saved={saved} onToggle={onToggleSaved} disabled={narrating} />
        ) : null}
      </div>

      <div className={styles.center}>
        {isPodcast ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnXs}`}
            aria-label="Rewind 15 seconds"
            onClick={onRewind15}
          >
            <SeekBack15Icon size={32} />
          </button>
        ) : isDJ ? (
          // momentary action, not a toggle
          <button
            type="button"
            className={`${styles.btn} ${styles.btnXs}`}
            aria-label="Switch DJ set"
            onClick={onDJSignal}
          >
            <DJIcon size={32} />
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnXs} ${shuffle ? styles.toggleOn : ''}`}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            onClick={onToggleShuffle}
          >
            <ShuffleIcon size={32} />
          </button>
        )}

        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm} ${disallowPrev ? styles.btnDisabled : ''}`}
          aria-label="Previous"
          aria-disabled={disallowPrev}
          disabled={disallowPrev}
          onClick={disallowPrev ? undefined : onPrev}
        >
          <PrevIcon size={40} />
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.btnLg}`}
          aria-label={isPaused ? 'Play' : 'Pause'}
          onClick={onPlayPause}
        >
          {isPaused ? <PlayIcon size={36} /> : <PauseIcon size={36} />}
        </button>

        <button
          type="button"
          className={`${styles.btn} ${styles.btnSm} ${disallowNext ? styles.btnDisabled : ''}`}
          aria-label="Next"
          aria-disabled={disallowNext}
          disabled={disallowNext}
          onClick={disallowNext ? undefined : onNext}
        >
          <NextIcon size={40} />
        </button>

        {isPodcast ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnXs}`}
            aria-label="Forward 15 seconds"
            onClick={onForward15}
          >
            <SeekForward15Icon size={32} />
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnXs} ${repeatActive && !repeatDisabled ? styles.toggleOn : ''} ${repeatDisabled ? styles.btnDisabled : ''}`}
            aria-label={`Repeat ${repeat}`}
            aria-pressed={repeatActive}
            aria-disabled={repeatDisabled}
            disabled={repeatDisabled}
            onClick={repeatDisabled ? undefined : onCycleRepeat}
          >
            {repeat === 'track' ? <RepeatOneIcon size={32} /> : <RepeatIcon size={32} />}
          </button>
        )}
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnXs}`}
          aria-label="More"
          onClick={onMore}
        >
          <MoreIcon size={28} />
        </button>
      </div>
    </div>
  )
}

export const Controls = memo(ControlsImpl)
