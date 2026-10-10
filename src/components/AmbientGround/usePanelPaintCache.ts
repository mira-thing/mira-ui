import { useLayoutEffect, type RefObject } from 'react'

const PAD = 54
const MARKER = 'data-glass-cached'
const PAINT = '--glass-paint'
const FACE = '--glass-face'
interface PanelPaint {
  border: Blob
  face: Blob
}
const paints = new Map<string, Promise<PanelPaint | null>>()

function panelImage(panel: HTMLElement, density: number): Promise<PanelPaint | null> {
  const computed = getComputedStyle(panel)
  const style = document.createElement('div').style
  for (const property of [
    'width',
    'height',
    'border-right',
    'border-top-color',
    'border-bottom-color',
    'border-radius',
    'box-shadow',
    '--glass-base',
  ]) {
    style.setProperty(property, computed.getPropertyValue(property))
  }
  const key = [
    density,
    style.width,
    style.height,
    style.borderRight,
    style.borderTopColor,
    style.borderBottomColor,
    style.borderRadius,
    style.boxShadow,
    style.getPropertyValue('--glass-base'),
  ].join(';')
  const existing = paints.get(key)
  if (existing) return existing
  const pending = (async () => {
    const border = await buildPanelImage(style, density)
    if (!border) return null
    const face = await buildPanelImage(style, density, true)
    return face ? { border, face } : null
  })()
  paints.set(key, pending)
  if (paints.size > 8) paints.delete(paints.keys().next().value!)
  void pending.then((blob) => {
    if (!blob && paints.get(key) === pending) paints.delete(key)
  })
  return pending
}

function buildPanelImage(
  style: CSSStyleDeclaration,
  density: number,
  base = false,
): Promise<Blob | null> {
  const pad = base ? 0 : PAD
  const width = parseFloat(style.width)
  const height = parseFloat(style.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil((width + pad * 2) * density)
  canvas.height = Math.ceil((height + pad * 2) * density)
  if (!width || !height || canvas.width * canvas.height > 4_000_000) {
    return Promise.resolve(null)
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(canvas.width))
  svg.setAttribute('height', String(canvas.height))
  svg.setAttribute('viewBox', `0 0 ${width + pad * 2} ${height + pad * 2}`)
  const object = document.createElementNS(svg.namespaceURI, 'foreignObject')
  object.setAttribute('width', '100%')
  object.setAttribute('height', '100%')
  const face = document.createElement('div')
  Object.assign(face.style, {
    position: 'absolute',
    left: `${pad}px`,
    top: `${pad}px`,
    boxSizing: 'border-box',
    width: `${width}px`,
    height: `${height}px`,
    backgroundImage: base ? style.getPropertyValue('--glass-base') : 'none',
    border: style.borderRight,
    borderColor: base ? 'transparent' : style.borderRightColor,
    borderTopColor: base ? 'transparent' : style.borderTopColor,
    borderBottomColor: base ? 'transparent' : style.borderBottomColor,
    borderRadius: base ? '0' : style.borderRadius,
    boxShadow: base ? 'none' : style.boxShadow,
  })
  object.appendChild(face)
  svg.appendChild(object)

  return new Promise((resolve) => {
    const image = new Image()
    const timeout = window.setTimeout(() => finish(null), 8000)
    let finished = false
    function finish(blob: Blob | null) {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      image.onload = image.onerror = null
      resolve(blob)
    }
    image.onerror = () => finish(null)
    image.onload = () => {
      try {
        const context = canvas.getContext('2d')
        if (!context) return finish(null)
        context.drawImage(image, 0, 0)
        canvas.toBlob(finish)
      } catch {
        finish(null)
      }
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
  })
}

export function usePanelPaintCache(
  container: RefObject<HTMLElement | null>,
  layoutKey: string,
  scale: number,
) {
  useLayoutEffect(() => {
    const host = container.current
    if (!host || typeof URL.createObjectURL !== 'function') return
    let generation = 0
    let timer = 0
    let frame = 0
    let geometry = ''
    let installed: { panel: HTMLElement; url: string; faceUrl: string }[] = []

    function clear(keepConnected = false) {
      generation++
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      installed = installed.filter(({ panel, url, faceUrl }) => {
        if (keepConnected && host!.contains(panel)) return true
        panel.removeAttribute(MARKER)
        panel.style.removeProperty(PAINT)
        panel.style.removeProperty(FACE)
        URL.revokeObjectURL(url)
        URL.revokeObjectURL(faceUrl)
        return false
      })
    }

    async function prepare(version: number) {
      const density = Math.max(1, window.devicePixelRatio * scale)
      const ready: { panel: HTMLElement; blob: PanelPaint }[] = []
      for (const panel of host!.querySelectorAll<HTMLElement>('[data-glass-panel]')) {
        if (version !== generation) return
        if (installed.some((entry) => entry.panel === panel)) continue
        const blob = await panelImage(panel, density)
        if (blob) ready.push({ panel, blob })
      }
      if (version !== generation) return
      frame = requestAnimationFrame(() => {
        if (version !== generation) return
        for (const { panel, blob } of ready) {
          if (!host!.contains(panel)) continue
          const url = URL.createObjectURL(blob.border)
          const faceUrl = URL.createObjectURL(blob.face)
          panel.style.setProperty(FACE, `url("${faceUrl}")`)
          panel.style.setProperty(PAINT, `url("${url}")`)
          panel.setAttribute(MARKER, '')
          installed.push({ panel, url, faceUrl })
        }
      })
    }

    function refresh(keepConnected = false) {
      clear(keepConnected)
      geometry = dimensions()
      timer = window.setTimeout(() => void prepare(generation), 350)
    }

    function dimensions() {
      return Array.from(host!.querySelectorAll<HTMLElement>('[data-glass-panel]'))
        .map((panel) => `${panel.offsetWidth},${panel.offsetHeight}`)
        .join(';')
    }

    function resize() {
      if (dimensions() !== geometry) refresh()
    }

    const observer = new MutationObserver((records) => {
      if (
        records.some((record) =>
          Array.from(record.addedNodes).some(
            (node) =>
              node instanceof HTMLElement &&
              (node.matches('[data-glass-panel]') || node.querySelector('[data-glass-panel]')),
          ),
        )
      )
        refresh(true)
    })
    observer.observe(host, { childList: true, subtree: true })
    window.addEventListener('resize', resize)
    refresh()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      clear()
    }
  }, [container, layoutKey, scale])
}
