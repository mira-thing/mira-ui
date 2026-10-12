import type { CSSProperties, HTMLAttributes, Ref } from 'react'
import styles from './Surface.module.scss'

export type SurfaceVariant = 'panel' | 'bar' | 'card' | 'floating'

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  variant: SurfaceVariant
  /** alpha of the theme tint over the glass; each variant has its own default */
  tint?: number
  focused?: boolean
  /** clips the content to the radius, which the cached glass cannot do (it paints outside) */
  clip?: boolean
  /** rasterised by the paint cache; panels and bars default to true */
  cache?: boolean
  /** a hole in the player's background depth shade, for that layout ('' for both) */
  depth?: 'lyrics' | 'art' | ''
  as?: 'div' | 'section' | 'li'
  ref?: Ref<HTMLElement>
}

const CACHED: Record<SurfaceVariant, boolean> = {
  panel: true,
  bar: true,
  card: false,
  floating: false,
}

/** The one glass surface: the variant sets the glass, the theme sets the tint. */
export function Surface({
  variant,
  tint,
  focused = false,
  clip = false,
  cache = CACHED[variant],
  depth,
  as: Tag = 'div',
  className,
  style,
  children,
  ref,
  ...props
}: SurfaceProps) {
  const classes = [styles.surface, styles[variant], focused ? styles.focused : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <Tag
      {...props}
      ref={ref as Ref<never>}
      className={classes}
      style={
        tint === undefined
          ? style
          : ({ ...style, '--surface-tint-alpha': String(tint) } as CSSProperties)
      }
      data-glass-panel={cache ? '' : undefined}
      data-depth-panel={depth}
    >
      {clip ? <div className={styles.clip}>{children}</div> : children}
    </Tag>
  )
}
