import { IconButton } from './IconButton'
import { PlayPauseIcon } from './PlayPauseIcon'

export interface PlayPauseButtonProps {
  isPaused: boolean
  onPress?: () => void
  /** `lg` is the player's filled disc; `mini` is a bare glyph for the mini-player */
  size?: 'mini' | 'lg'
}

const LAYOUT = {
  mini: { button: 'md', icon: 28 },
  lg: { button: 'lg', icon: 36 },
} as const

export function PlayPauseButton({ isPaused, onPress, size = 'lg' }: PlayPauseButtonProps) {
  const { button, icon } = LAYOUT[size]
  return (
    <IconButton
      size={button}
      label={isPaused ? 'Play' : 'Pause'}
      icon={<PlayPauseIcon isPaused={isPaused} size={icon} />}
      onPress={onPress}
    />
  )
}
