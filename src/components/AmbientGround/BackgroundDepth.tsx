import { useContext, useLayoutEffect, useRef } from 'react'
import { backgroundDepthColor } from '@/hooks/useColorExtract'
import { useUiScale } from '@/uiScale'
import { ArtworkPaletteContext } from './artworkTheme'
import styles from './AmbientGround.module.scss'

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
}

export function BackgroundDepth({
  layoutKey,
  showLyrics,
}: {
  layoutKey: string
  showLyrics: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const paths = useRef({ lyrics: '', art: '' })
  const activeLayout = useRef(showLyrics)
  const scale = useUiScale()
  const palette = useContext(ArtworkPaletteContext)
  const tint = backgroundDepthColor(palette[0] ?? [45, 50, 61])

  useLayoutEffect(() => {
    const svg = svgRef.current
    const path = pathRef.current
    const host = svg?.parentElement
    if (!svg || !path || !host) return

    function measure() {
      if (!host || !svg || !path) return
      const w = host.clientWidth
      const h = host.clientHeight
      const radius = parseFloat(getComputedStyle(host).getPropertyValue('--panel-radius')) || 18
      const holes = Array.from(host.querySelectorAll<HTMLElement>('[data-depth-panel]')).map(
        (panel) => {
          let x = 0
          let y = 0
          let node: HTMLElement | null = panel
          while (node && node !== host) {
            x += node.offsetLeft
            y += node.offsetTop
            node = node.offsetParent as HTMLElement | null
          }
          return {
            layout: panel.dataset.depthPanel,
            path: roundedRect(x, y, panel.offsetWidth, panel.offsetHeight, radius),
          }
        },
      )
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
      const outline = `M0,0H${w}V${h}H0Z`
      const forLayout = (layout: string) =>
        outline +
        holes
          .filter((hole) => !hole.layout || hole.layout === layout)
          .map((hole) => hole.path)
          .join('')
      paths.current = { lyrics: forLayout('lyrics'), art: forLayout('art') }
      path.setAttribute('d', paths.current[activeLayout.current ? 'lyrics' : 'art'])
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [layoutKey, scale])

  useLayoutEffect(() => {
    activeLayout.current = showLyrics
    pathRef.current?.setAttribute('d', paths.current[showLyrics ? 'lyrics' : 'art'])
  }, [showLyrics])

  return (
    <svg
      ref={svgRef}
      className={styles.depthShade}
      style={{ fill: `rgb(${tint.join(', ')})` }}
      aria-hidden="true"
      focusable="false"
    >
      <path ref={pathRef} fillRule="evenodd" />
    </svg>
  )
}
