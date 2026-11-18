import { useLayoutEffect, type RefObject } from 'react'
import { GLASS_PAD } from '@/theme/metrics'

const MARKER = 'data-glass-cached'
const PAINT = '--glass-paint'
const FACE = '--glass-face'
interface PanelPaint {
  url: string
  faceUrl: string
}
interface CacheEntry {
  pending: Promise<PanelPaint | null>
  paint?: PanelPaint
  /** panels showing or about to show this paint; only an unused, built paint is evicted */
  users: number
}
// one URL per paint: a fresh URL means a fresh decode, and Chrome 69 draws the panel blank until then
const cache = new Map<string, CacheEntry>()
const CACHE_LIMIT = 8

/** The entry for `key`, moved to the back of the eviction order. */
function touch(key: string): CacheEntry | undefined {
  const entry = cache.get(key)
  if (entry) {
    cache.delete(key)
    cache.set(key, entry)
  }
  return entry
}

function evict() {
  for (const [key, entry] of cache) {
    if (cache.size <= CACHE_LIMIT) return
    if (entry.users > 0 || !entry.paint) continue
    cache.delete(key)
    URL.revokeObjectURL(entry.paint.url)
    URL.revokeObjectURL(entry.paint.faceUrl)
  }
}

/** A built paint for `key`, counted as shown until `release`; undefined if it isn't built. */
function acquire(key: string): PanelPaint | undefined {
  const entry = touch(key)
  if (!entry?.paint) return undefined
  entry.users++
  return entry.paint
}

function release(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  entry.users--
  evict()
}

function decodeAhead(url: string) {
  const image = new Image()
  image.src = url
  void image.decode?.().catch(() => {})
}

const SPEC_PROPERTIES = [
  'width',
  'height',
  'border-right',
  'border-top-color',
  'border-bottom-color',
  'border-radius',
  'box-shadow',
  '--glass-base',
]

interface Installed {
  panel: HTMLElement
  spec: PanelSpec
}

/** The glass a panel paints, at one size and density. */
interface PanelSpec {
  key: string
  style: CSSStyleDeclaration
  density: number
}

function specFrom(read: (property: string) => string, density: number): PanelSpec {
  const style = document.createElement('div').style
  for (const property of SPEC_PROPERTIES) style.setProperty(property, read(property))
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
  return { key, style, density }
}

/** Read from a panel that isn't cached yet: once cached, its own shadow and border are gone. */
function panelSpec(panel: HTMLElement, density: number): PanelSpec {
  const computed = getComputedStyle(panel)
  return specFrom((property) => computed.getPropertyValue(property), density)
}

/** The same glass at the panel's current size. */
function resizedSpec(spec: PanelSpec, panel: HTMLElement): PanelSpec {
  const computed = getComputedStyle(panel)
  return specFrom(
    (property) =>
      property === 'width' || property === 'height'
        ? computed.getPropertyValue(property)
        : spec.style.getPropertyValue(property),
    spec.density,
  )
}

function panelImage({ key, style, density }: PanelSpec): Promise<PanelPaint | null> {
  const existing = touch(key)
  if (existing) return existing.pending
  const entry: CacheEntry = { users: 0, pending: Promise.resolve(null) }
  entry.pending = (async () => {
    const border = await buildPanelImage(style, density)
    if (!border) return null
    const face = await buildPanelImage(style, density, true)
    if (!face) return null
    const paint = { url: URL.createObjectURL(border), faceUrl: URL.createObjectURL(face) }
    decodeAhead(paint.url)
    decodeAhead(paint.faceUrl)
    entry.paint = paint
    return paint
  })()
  cache.set(key, entry)
  evict()
  void entry.pending.then((paint) => {
    if (!paint && cache.get(key) === entry) cache.delete(key)
  })
  return entry.pending
}

function buildPanelImage(
  style: CSSStyleDeclaration,
  density: number,
  base = false,
): Promise<Blob | null> {
  const pad = base ? 0 : GLASS_PAD
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
    let installed: Installed[] = []
    // built for a panel and awaiting install; held, so building the next paint can't evict it
    const held: (Installed & { paint: PanelPaint })[] = []

    function install(panel: HTMLElement, spec: PanelSpec, paint: PanelPaint) {
      show(panel, paint)
      panel.setAttribute(MARKER, '')
      installed.push({ panel, spec })
      sizes?.observe(panel)
    }

    function show(panel: HTMLElement, { url, faceUrl }: PanelPaint) {
      panel.style.setProperty(FACE, `url("${faceUrl}")`)
      panel.style.setProperty(PAINT, `url("${url}")`)
    }

    function uninstall({ panel, spec }: Installed) {
      sizes?.unobserve(panel)
      panel.removeAttribute(MARKER)
      panel.style.removeProperty(PAINT)
      panel.style.removeProperty(FACE)
      release(spec.key)
    }

    function drop(entry: Installed) {
      uninstall(entry)
      installed = installed.filter((e) => e !== entry)
    }

    function clear(keepConnected = false) {
      generation++
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      for (const { spec } of held.splice(0)) release(spec.key)
      installed = installed.filter((entry) => {
        if (keepConnected && host!.contains(entry.panel)) return true
        uninstall(entry)
        return false
      })
    }

    async function prepare(version: number) {
      const density = Math.max(1, window.devicePixelRatio * scale)
      for (const panel of host!.querySelectorAll<HTMLElement>('[data-glass-panel]')) {
        if (version !== generation) return
        if (installed.some((entry) => entry.panel === panel)) continue
        const spec = panelSpec(panel, density)
        const paint = (await panelImage(spec)) && acquire(spec.key)
        if (!paint) continue
        if (version !== generation) return release(spec.key)
        held.push({ panel, spec, paint })
      }
      if (version !== generation) return
      frame = requestAnimationFrame(() => {
        for (const { panel, spec, paint } of held.splice(0)) {
          if (host!.contains(panel)) install(panel, spec, paint)
          else release(spec.key)
        }
      })
    }

    // a carousel card widens on focus; a stretched paint would distort its corners and shadow
    const sizes =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            let stale = false
            for (const { target } of entries) {
              const entry = installed.find((e) => e.panel === target)
              if (!entry) continue
              // a panel that left the page is done with, not resized
              if (!host!.contains(entry.panel)) {
                drop(entry)
                continue
              }
              const spec = resizedSpec(entry.spec, entry.panel)
              if (spec.key === entry.spec.key) continue
              const paint = acquire(spec.key)
              if (paint) {
                show(entry.panel, paint)
                release(entry.spec.key)
                entry.spec = spec
              } else {
                drop(entry)
                stale = true
              }
            }
            if (stale) refresh(true)
            else geometry = dimensions()
          })
        : null

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
      sizes?.disconnect()
      window.removeEventListener('resize', resize)
      clear()
    }
  }, [container, layoutKey, scale])
}
