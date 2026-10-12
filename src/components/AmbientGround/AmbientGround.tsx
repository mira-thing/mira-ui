import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { GroundRole, RGB } from '@/hooks/useColorExtract'
import { deriveRoles } from '@/theme/seed'
import { useTheme } from '@/theme/theme'
import styles from './AmbientGround.module.scss'

// three orbs per scene
const ORBS: { role: GroundRole; className: string; peak: number }[] = [
  { role: 'deep', className: styles.orbDeep, peak: 1 },
  { role: 'base', className: styles.orbBase, peak: 0.9 },
  { role: 'hot', className: styles.orbHot, peak: 0.85 },
]

function rgba(rgb: RGB, alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

function orbPaint(color: RGB, peak: number): string {
  return `radial-gradient(closest-side, ${rgba(color, peak)} 0%, ${rgba(color, peak * 0.97)} 10%, ${rgba(color, peak * 0.72)} 30%, ${rgba(color, peak * 0.34)} 52%, ${rgba(color, peak * 0.09)} 74%, ${rgba(color, peak * 0.015)} 90%, ${rgba(color, 0)} 100%)`
}

function bloomPaint(glow: RGB): string {
  return `radial-gradient(closest-side, ${rgba(glow, 0.28)} 0%, ${rgba(glow, 0.09)} 45%, ${rgba(glow, 0)} 100%)`
}

// an empty palette still mounts its orbs, so both scenes drift in phase from the start
function Field({ palette }: { palette: RGB[] }) {
  const { paints, bloom } = useMemo(() => {
    if (palette.length === 0) return { paints: ORBS.map(() => 'none'), bloom: 'none' }
    const roles = deriveRoles(palette)
    return {
      paints: ORBS.map((orb) => orbPaint(roles.ground[orb.role], orb.peak)),
      bloom: bloomPaint(roles.glow),
    }
  }, [palette])
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

const GroundLayers = memo(function GroundLayers({
  palette,
  idle,
}: {
  palette: RGB[]
  idle: boolean
}) {
  const [front, setFront] = useState(palette)
  const [back, setBack] = useState(palette)
  const [showFront, setShowFront] = useState(true)
  const lastPalette = useRef(palette)
  const busy = useRef(false)
  const timers = useRef({ frame: 0, settle: 0 })
  const [settled, setSettled] = useState(0)

  useEffect(() => {
    // idle covers both scenes, so they keep the last album until one arrives
    if (idle || lastPalette.current === palette || busy.current) return
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
  }, [palette, idle, showFront, settled])

  useEffect(
    () => () => {
      window.cancelAnimationFrame(timers.current.frame)
      window.clearTimeout(timers.current.settle)
    },
    [],
  )

  const shown = (visible: boolean) => (visible ? styles.visible : styles.hidden)
  return (
    <div className={styles.ground} aria-hidden>
      <div className={`${styles.layer} ${shown(!idle && showFront)}`}>
        <Field palette={front} />
      </div>
      <div className={`${styles.layer} ${shown(!idle && !showFront)}`}>
        <Field palette={back} />
      </div>
      <div className={styles.vignette} />
      <div className={styles.grain} />
      <div className={`${styles.layer} ${styles.idle} ${shown(idle)}`} />
    </div>
  )
})

/** The themed background: the album's drifting orbs, or the idle look. */
export function AmbientGround() {
  const { source, palette } = useTheme()
  return <GroundLayers palette={palette} idle={source === 'idle'} />
}
