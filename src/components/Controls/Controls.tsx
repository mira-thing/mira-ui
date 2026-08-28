import { memo } from 'react'
import type { ReactNode } from 'react'
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

const SIZE_CLASS = { xs: styles.btnXs, sm: styles.btnSm, lg: styles.btnLg }

interface ControlButtonProps {
  size: keyof typeof SIZE_CLASS
  label: string
  children: ReactNode
  onPress?: () => void
  // left undefined by controls that are never disabled or never a toggle, so they render
  // without the attribute at all
  disabled?: boolean
  pressed?: boolean
  // lit up, which repeat needs to keep separate from pressed: it reports pressed while
  // disabled for a DJ set, but must not look lit
  active?: boolean
}

function ControlButton({
  size,
  label,
  children,
  onPress,
  disabled,
  pressed,
  active,
}: ControlButtonProps) {
  const className = [
    styles.btn,
    SIZE_CLASS[size],
    active && styles.toggleOn,
    disabled && styles.btnDisabled,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onPress}
    >
      {children}
    </button>
  )
}

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
          <ControlButton size="xs" label="Rewind 15 seconds" onPress={onRewind15}>
            <SeekBack15Icon size={32} />
          </ControlButton>
        ) : isDJ ? (
          // momentary action, not a toggle. Jumping mid-line cuts the speech short
          <ControlButton size="xs" label="Switch DJ set" disabled={narrating} onPress={onDJSignal}>
            <DJIcon size={32} />
          </ControlButton>
        ) : (
          <ControlButton
            size="xs"
            label="Shuffle"
            pressed={shuffle}
            active={shuffle}
            onPress={onToggleShuffle}
          >
            <ShuffleIcon size={32} />
          </ControlButton>
        )}

        <ControlButton size="sm" label="Previous" disabled={disallowPrev} onPress={onPrev}>
          <PrevIcon size={40} />
        </ControlButton>

        <ControlButton size="lg" label={isPaused ? 'Play' : 'Pause'} onPress={onPlayPause}>
          {isPaused ? <PlayIcon size={36} /> : <PauseIcon size={36} />}
        </ControlButton>

        <ControlButton size="sm" label="Next" disabled={disallowNext} onPress={onNext}>
          <NextIcon size={40} />
        </ControlButton>

        {isPodcast ? (
          <ControlButton size="xs" label="Forward 15 seconds" onPress={onForward15}>
            <SeekForward15Icon size={32} />
          </ControlButton>
        ) : (
          <ControlButton
            size="xs"
            label={`Repeat ${repeat}`}
            pressed={repeatActive}
            active={repeatActive && !repeatDisabled}
            disabled={repeatDisabled}
            onPress={onCycleRepeat}
          >
            {repeat === 'track' ? <RepeatOneIcon size={32} /> : <RepeatIcon size={32} />}
          </ControlButton>
        )}
      </div>

      <div className={styles.right}>
        <ControlButton size="xs" label="More" onPress={onMore}>
          <MoreIcon size={28} />
        </ControlButton>
      </div>
    </div>
  )
}

export const Controls = memo(ControlsImpl)
