import { useLayoutEffect, useRef } from 'react'

const PAUSE = [
  7.5, 5.5, 8.5, 5.5, 8.5, 18.5, 7.5, 18.5, 15.5, 5.5, 16.5, 5.5, 16.5, 18.5, 15.5, 18.5,
]
const PLAY = [7.5, 5.5, 12, 8.1, 12, 15.9, 7.5, 18.5, 12, 8.1, 18.5, 12, 18.5, 12, 12, 15.9]
const DURATION = 180

function shape(progress: number): string {
  const p = PAUSE.map((value, i) => value + (PLAY[i] - value) * progress)
  return [0, 8]
    .map(
      (i) =>
        `M${p[i]},${p[i + 1]}L${p[i + 2]},${p[i + 3]}L${p[i + 4]},${p[i + 5]}L${p[i + 6]},${p[i + 7]}Z`,
    )
    .join('')
}

export function PlayPauseIcon({ isPaused }: { isPaused: boolean }) {
  const pathRef = useRef<SVGPathElement>(null)
  const progress = useRef(isPaused ? 1 : 0)

  useLayoutEffect(() => {
    const path = pathRef.current
    if (!path) return
    const target = isPaused ? 1 : 0
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      progress.current = target
      path.setAttribute('d', shape(target))
      return
    }
    const from = progress.current
    if (from === target) return
    path.setAttribute('d', shape(from))
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / DURATION))
      const eased = t * t * (3 - 2 * t)
      progress.current = from + (target - from) * eased
      path.setAttribute('d', shape(progress.current))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPaused])

  return (
    <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
      <path
        ref={pathRef}
        d={shape(isPaused ? 1 : 0)}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  )
}
