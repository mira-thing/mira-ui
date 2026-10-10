import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import {
  groundTone,
  surfaceGlowColor,
  useDominantColors,
  type GroundRole,
  type RGB,
} from '@/hooks/useColorExtract'
import { ArtworkPaletteContext, useArtworkSurface } from './artworkTheme'
import styles from './AmbientGround.module.scss'

interface Props {
  artUrl?: string
}

const FALLBACK: RGB = [45, 50, 61]

// three orbs per scene
const ORBS: { role: GroundRole; className: string; peak: number }[] = [
  { role: 'deep', className: styles.orbDeep, peak: 1 },
  { role: 'base', className: styles.orbBase, peak: 0.9 },
  { role: 'hot', className: styles.orbHot, peak: 0.85 },
]

function rgba(rgb: RGB, alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

function orbPaint(rgb: RGB, role: GroundRole, peak: number): string {
  const color = groundTone(rgb, role)
  return `radial-gradient(closest-side, ${rgba(color, peak)} 0%, ${rgba(color, peak * 0.97)} 10%, ${rgba(color, peak * 0.72)} 30%, ${rgba(color, peak * 0.34)} 52%, ${rgba(color, peak * 0.09)} 74%, ${rgba(color, peak * 0.015)} 90%, ${rgba(color, 0)} 100%)`
}

function orbColors(palette: RGB[]): RGB[] {
  const first = palette[0] ?? FALLBACK
  const second = palette[1] ?? first
  const third = palette[2] ?? second
  // deep, base, hot
  return [second, first, third]
}

function bloomPaint(rgb: RGB): string {
  const glow = surfaceGlowColor(rgb)
  return `radial-gradient(closest-side, ${rgba(glow, 0.28)} 0%, ${rgba(glow, 0.09)} 45%, ${rgba(glow, 0)} 100%)`
}

function Field({ palette }: { palette: RGB[] }) {
  const paints = useMemo(() => {
    const colors = orbColors(palette)
    return ORBS.map((orb, i) => orbPaint(colors[i], orb.role, orb.peak))
  }, [palette])
  const bloom = useMemo(() => bloomPaint(palette[0] ?? FALLBACK), [palette])
  return (
    <>
      {paints.map((paint, i) => (
        <div
          key={ORBS[i].className}
          className={`${styles.orb} ${ORBS[i].className}`}
          style={{ backgroundImage: paint }}
        />
      ))}
      <div className={styles.bloom} style={{ backgroundImage: bloom }} />
    </>
  )
}

const GroundLayers = memo(function GroundLayers({ palette }: { palette: RGB[] }) {
  const [front, setFront] = useState(palette)
  const [back, setBack] = useState(palette)
  const [showFront, setShowFront] = useState(true)
  const lastPalette = useRef(palette)
  const busy = useRef(false)
  const timers = useRef({ frame: 0, settle: 0 })
  const [settled, setSettled] = useState(0)

  useEffect(() => {
    if (lastPalette.current === palette || busy.current) return
    lastPalette.current = palette
    busy.current = true
    timers.current.frame = window.requestAnimationFrame(() => {
      if (showFront) {
        setBack(palette)
        setShowFront(false)
      } else {
        setFront(palette)
        setShowFront(true)
      }
      // let the fade finish
      timers.current.settle = window.setTimeout(() => {
        busy.current = false
        setSettled((n) => n + 1)
      }, 1200)
    })
    // rapid skips keep only the latest palette
  }, [palette, showFront, settled])

  useEffect(
    () => () => {
      window.cancelAnimationFrame(timers.current.frame)
      window.clearTimeout(timers.current.settle)
    },
    [],
  )

  return (
    <div className={styles.ground} aria-hidden>
      <div className={`${styles.layer} ${showFront ? styles.visible : styles.hidden}`}>
        <Field palette={front} />
      </div>
      <div className={`${styles.layer} ${showFront ? styles.hidden : styles.visible}`}>
        <Field palette={back} />
      </div>
      <div className={styles.vignette} />
      <div className={styles.grain} />
    </div>
  )
})

export function ArtworkTheme({ artUrl, children }: Props & { children: ReactNode }) {
  const palette = useDominantColors(artUrl)
  return (
    <ArtworkPaletteContext.Provider value={palette}>
      <GroundLayers palette={palette} />
      {children}
    </ArtworkPaletteContext.Provider>
  )
}

interface ArtworkSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: number
  strength?: number
}

export function ArtworkSurface({
  tone = 0,
  strength = 0.46,
  style,
  ...props
}: ArtworkSurfaceProps) {
  const tintStyle = useArtworkSurface(tone, strength)
  return <div {...props} data-glass-panel="" style={{ ...tintStyle, ...style }} />
}
