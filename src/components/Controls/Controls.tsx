import { memo } from 'react'
import { SaveButton } from './SaveButton'
import { useNarration } from '@/hooks/useDJNarration'
import { IconButton, PlayPauseButton } from '@/ui/Button'
import { Icon } from '@/ui/icons'
import styles from './Controls.module.scss'

import type { RepeatMode } from '@/hooks/usePlayerControls'

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
          <IconButton size="xs" label="Rewind 15 seconds" icon="seekBack15" onPress={onRewind15} />
        ) : isDJ ? (
          // momentary action, not a toggle. Jumping mid-line cuts the speech short
          <IconButton
            size="xs"
            label="Switch DJ set"
            icon="dj"
            disabled={narrating}
            onPress={onDJSignal}
          />
        ) : (
          <IconButton
            size="xs"
            label="Shuffle"
            icon="shuffle"
            pressed={shuffle}
            active={shuffle}
            onPress={onToggleShuffle}
          />
        )}

        <IconButton
          size="sm"
          label="Previous"
          icon="prev"
          disabled={disallowPrev}
          onPress={onPrev}
        />

        <PlayPauseButton size="lg" isPaused={isPaused} onPress={onPlayPause} />

        <IconButton size="sm" label="Next" icon="next" disabled={disallowNext} onPress={onNext} />

        {isPodcast ? (
          <IconButton
            size="xs"
            label="Forward 15 seconds"
            icon="seekForward15"
            onPress={onForward15}
          />
        ) : (
          <IconButton
            size="xs"
            label={`Repeat ${repeat}`}
            icon={repeat === 'track' ? 'repeatOne' : 'repeat'}
            pressed={repeatActive}
            active={repeatActive && !repeatDisabled}
            disabled={repeatDisabled}
            onPress={onCycleRepeat}
          />
        )}
      </div>

      <div className={styles.right}>
        <IconButton size="xs" label="More" icon={<Icon name="more" size={28} />} onPress={onMore} />
      </div>
    </div>
  )
}

export const Controls = memo(ControlsImpl)
