import { useEffect, useState } from 'react'

export type RGB = [number, number, number]

// the art is reduced to a 5-bit histogram
const DEFAULT: RGB = [70, 75, 95]
const SAMPLE = 32
const SAMPLE_TAPS = 4
const SAMPLE_GRID = SAMPLE * SAMPLE_TAPS
const BINS = 16
const GRAY = BINS
const GRAY_C = 0.04
const GRAY_K = 0.012
// skin reads as the subject rather
const SKIN_PENALTY = 0.45
const SKIN_LO = 10
const SKIN_HI = 37
const SKIN_S = 0.82
const VIVID_Q = 0.9
const WARM_LO = 2
const WARM_HI = 4
const WARM_PENALTY = 0.5

const CACHE_MAX = 500
const cache = new Map<string, Sample>()

// one sample feeds the accent and the ambient ground
interface Sample {
  rgb: RGB
  palette: RGB[]
}

const DEFAULT_PALETTE: RGB[] = [DEFAULT, [48, 55, 68], [34, 37, 45]]
const DEFAULT_SAMPLE: Sample = { rgb: DEFAULT, palette: DEFAULT_PALETTE }

function remember(url: string, sample: Sample) {
  if (!cache.has(url) && cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(url, sample)
}

let sharedCtx: CanvasRenderingContext2D | null = null

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (sharedCtx) return sharedCtx
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_GRID
  canvas.height = SAMPLE_GRID
  sharedCtx = canvas.getContext('2d', { willReadFrequently: true })
  if (sharedCtx) sharedCtx.imageSmoothingEnabled = false
  return sharedCtx
}

const sampledPixels = new Uint8ClampedArray(SAMPLE * SAMPLE * 4)

function samplePixels(data: Uint8ClampedArray): Uint8ClampedArray {
  for (let y = 0; y < SAMPLE; y++) {
    for (let x = 0; x < SAMPLE; x++) {
      let r = 0
      let g = 0
      let b = 0
      let alpha = 0
      for (let dy = 0; dy < SAMPLE_TAPS; dy++) {
        for (let dx = 0; dx < SAMPLE_TAPS; dx++) {
          const i = ((y * SAMPLE_TAPS + dy) * SAMPLE_GRID + x * SAMPLE_TAPS + dx) * 4
          const a = data[i + 3]
          r += data[i] * a
          g += data[i + 1] * a
          b += data[i + 2] * a
          alpha += a
        }
      }
      const out = (y * SAMPLE + x) * 4
      sampledPixels[out] = alpha ? r / alpha : 0
      sampledPixels[out + 1] = alpha ? g / alpha : 0
      sampledPixels[out + 2] = alpha ? b / alpha : 0
      sampledPixels[out + 3] = alpha / (SAMPLE_TAPS * SAMPLE_TAPS)
    }
  }
  return sampledPixels
}

const UNCLASSIFIED = 255
const famOf = new Uint8Array(32768).fill(UNCLASSIFIED)
const chromaOf = new Float32Array(32768)

function classify(key: number): number {
  const r = (((key >> 10) & 31) << 3) | 4
  const g = (((key >> 5) & 31) << 3) | 4
  const b = ((key & 31) << 3) | 4
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const chroma = Math.sqrt(a * a + bb * bb)

  let family = GRAY
  if (chroma >= GRAY_C) {
    let hue = (Math.atan2(bb, a) * 180) / Math.PI
    if (hue < 0) hue += 360
    family = Math.floor((hue / 360) * BINS) % BINS
  }
  famOf[key] = family
  chromaOf[key] = chroma
  return family
}

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

// reused across calls so extracting a colour allocates nothing
const PIXELS = SAMPLE * SAMPLE
const slot = new Int32Array(32768)
const bucketKey = new Int32Array(PIXELS + 1)
const bucketN = new Int32Array(PIXELS + 1)
const bucketR = new Int32Array(PIXELS + 1)
const bucketG = new Int32Array(PIXELS + 1)
const bucketB = new Int32Array(PIXELS + 1)
const famWeight = new Float64Array(BINS + 1)
const famChroma = new Float64Array(BINS + 1)
const famCw = new Float64Array(BINS + 1)
const famR = new Float64Array(BINS + 1)
const famG = new Float64Array(BINS + 1)
const famB = new Float64Array(BINS + 1)

function extractAccent(data: ArrayLike<number>): RGB | null {
  let buckets = 0
  let total = 0
  try {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      let idx = slot[key]
      if (idx === 0) {
        idx = ++buckets
        slot[key] = idx
        bucketKey[idx] = key
        bucketN[idx] = 0
        bucketR[idx] = 0
        bucketG[idx] = 0
        bucketB[idx] = 0
      }
      bucketN[idx]++
      bucketR[idx] += r
      bucketG[idx] += g
      bucketB[idx] += b
      total++
    }
    if (total === 0) return null

    famWeight.fill(0)
    famChroma.fill(0)
    famCw.fill(0)
    famR.fill(0)
    famG.fill(0)
    famB.fill(0)

    for (let i = 1; i <= buckets; i++) {
      const key = bucketKey[i]
      const family = famOf[key] === UNCLASSIFIED ? classify(key) : famOf[key]
      const chroma = chromaOf[key]
      const n = bucketN[i]
      const weight = n / total
      famWeight[family] += weight
      famChroma[family] += weight * chroma
      // squared so washed-out members barely move the family's centre
      const cw = weight * (chroma + 0.005) * (chroma + 0.005)
      famCw[family] += cw
      famR[family] += (cw * bucketR[i]) / n
      famG[family] += (cw * bucketG[i]) / n
      famB[family] += (cw * bucketB[i]) / n
    }

    let winner = -1
    let bestScore = -1
    let accent: RGB = DEFAULT
    for (let f = 0; f <= BINS; f++) {
      if (famWeight[f] === 0) continue
      const rgb: RGB = [
        Math.round(famR[f] / famCw[f]),
        Math.round(famG[f] / famCw[f]),
        Math.round(famB[f] / famCw[f]),
      ]
      const chroma = f === GRAY ? GRAY_K : famChroma[f] / famWeight[f]
      let score = Math.sqrt(famWeight[f]) * chroma
      if (f !== GRAY) {
        if (f >= WARM_LO && f <= WARM_HI) score *= WARM_PENALTY
        const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2])
        const deg = h * 360
        if (deg >= SKIN_LO && deg <= SKIN_HI && s <= SKIN_S) score *= SKIN_PENALTY
      }
      if (score > bestScore) {
        bestScore = score
        winner = f
        accent = rgb
      }
    }
    if (winner < 0) return null
    return winner === GRAY ? accent : vivid(accent, winner, buckets, total)
  } catch {
    return null
  } finally {
    for (let i = 1; i <= buckets; i++) slot[bucketKey[i]] = 0
  }
}

function vivid(accent: RGB, family: number, buckets: number, total: number): RGB {
  const members: number[] = []
  for (let i = 1; i <= buckets; i++) {
    if (famOf[bucketKey[i]] === family) members.push(i)
  }
  if (members.length === 0) return accent
  members.sort((a, b) => chromaOf[bucketKey[a]] - chromaOf[bucketKey[b]])

  const cut = famWeight[family] * (1 - VIVID_Q)
  let seen = 0
  let target = members[members.length - 1]
  for (let i = members.length - 1; i >= 0; i--) {
    seen += bucketN[members[i]] / total
    if (seen >= cut) {
      target = members[i]
      break
    }
  }
  const n = bucketN[target]
  const [, saturation] = rgbToHsl(bucketR[target] / n, bucketG[target] / n, bucketB[target] / n)
  const [h, s, l] = rgbToHsl(accent[0], accent[1], accent[2])
  return hslToRgb(h, Math.max(s, saturation), l)
}

function paletteFromFamilies(accent: RGB): RGB[] {
  const key = ((accent[0] >> 3) << 10) | ((accent[1] >> 3) << 5) | (accent[2] >> 3)
  const accentFamily = famOf[key] === UNCLASSIFIED ? classify(key) : famOf[key]
  const candidates: { family: number; score: number; rgb: RGB }[] = []

  for (let family = 0; family <= BINS; family++) {
    if (family === accentFamily || famWeight[family] === 0 || famCw[family] === 0) continue
    const chroma = family === GRAY ? GRAY_K : famChroma[family] / famWeight[family]
    candidates.push({
      family,
      score: famWeight[family] * (0.08 + Math.min(chroma, 0.32)),
      rgb: [
        Math.round(famR[family] / famCw[family]),
        Math.round(famG[family] / famCw[family]),
        Math.round(famB[family] / famCw[family]),
      ],
    })
  }
  candidates.sort((a, b) => b.score - a.score || a.family - b.family)

  const palette: RGB[] = [accent]
  for (const candidate of candidates) {
    const distinct = palette.every((color) => {
      const dr = color[0] - candidate.rgb[0]
      const dg = color[1] - candidate.rgb[1]
      const db = color[2] - candidate.rgb[2]
      return dr * dr + dg * dg + db * db >= 28 * 28
    })
    if (distinct) palette.push(candidate.rgb)
    if (palette.length === 3) break
  }
  return palette
}

function extract(img: HTMLImageElement): Sample | null {
  const ctx = ensureCanvas()
  if (!ctx) return null
  try {
    ctx.clearRect(0, 0, SAMPLE_GRID, SAMPLE_GRID)
    ctx.drawImage(img, 0, 0, SAMPLE_GRID, SAMPLE_GRID)
    const { data } = ctx.getImageData(0, 0, SAMPLE_GRID, SAMPLE_GRID)
    const rgb = extractAccent(samplePixels(data))
    if (!rgb) return null
    return { rgb, palette: paletteFromFamilies(rgb) }
  } catch {
    return null
  }
}

const pendingArtwork = new Map<string, Promise<void>>()
const loadedArtwork = new Map<string, HTMLImageElement>()
const loadingArtwork = new Map<string, Promise<HTMLImageElement | null>>()

export function loadArtwork(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  const cached = loadedArtwork.get(url)
  if (cached) return Promise.resolve(cached)
  const pending = loadingArtwork.get(url)
  if (pending) return pending
  const work = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    let finished = false
    const finish = (ready: boolean) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      img.onload = img.onerror = null
      if (ready) {
        if (loadedArtwork.size >= 12) loadedArtwork.delete(loadedArtwork.keys().next().value!)
        loadedArtwork.set(url, img)
      }
      resolve(ready ? img : null)
    }
    const timer = window.setTimeout(() => finish(false), 8000)
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.referrerPolicy = 'no-referrer'
    img.onload = () => {
      if (img.decode)
        void img.decode().then(
          () => finish(true),
          () => finish(false),
        )
      else finish(true)
    }
    img.onerror = () => finish(false)
    img.src = url
  })
  loadingArtwork.set(url, work)
  void work.then(() => loadingArtwork.delete(url))
  return work
}

export function prepareArtwork(url: string | undefined): Promise<void> {
  if (!url || cache.has(url)) return Promise.resolve()
  const pending = pendingArtwork.get(url)
  if (pending) return pending
  const work = loadArtwork(url).then((img) => {
    if (!img) return
    const sample = extract(img)
    if (sample) remember(url, sample)
  })
  pendingArtwork.set(url, work)
  void work.then(() => pendingArtwork.delete(url))
  return work
}

function useSample(url: string | undefined): Sample {
  const [sample, setSample] = useState<Sample>(() =>
    url ? (cache.get(url) ?? DEFAULT_SAMPLE) : DEFAULT_SAMPLE,
  )

  useEffect(() => {
    if (!url) {
      return
    }

    const cached = cache.get(url)
    if (cached) {
      setSample(cached)
      return
    }

    let cancelled = false
    const apply = (next: Sample) =>
      setSample((prev) =>
        prev.rgb[0] === next.rgb[0] &&
        prev.rgb[1] === next.rgb[1] &&
        prev.rgb[2] === next.rgb[2] &&
        prev.palette === next.palette
          ? prev
          : next,
      )

    const timer = window.setTimeout(
      () =>
        void prepareArtwork(url).then(() => {
          if (cancelled) return
          const next = cache.get(url)
          if (next) apply(next)
        }),
      300,
    )

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [url])

  return url ? (cache.get(url) ?? sample) : sample
}

export function useColorExtract(url: string | undefined): RGB {
  return useSample(url).rgb
}

export function useDominantColors(url: string | undefined): RGB[] {
  return useSample(url).palette
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

const DARK_L = 0.16
const DARK_S_CAP = 0.62
const SURFACE_L = 0.24
const SURFACE_S_CAP = 0.62

// saturated darkmode backdrop from the album accent colour
export function darkBg(rgb: RGB): string {
  const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const [r, g, b] = hslToRgb(h, Math.min(s, DARK_S_CAP), DARK_L)
  return `rgb(${r}, ${g}, ${b})`
}

// each layer gets its own value
export type GroundRole = 'base' | 'deep' | 'hot'

const ROLE: Record<GroundRole, { lo: number; hi: number; sat: number; gain: number }> = {
  // album colour
  base: { lo: 0.15, hi: 0.225, sat: 0.6, gain: 1 },
  // shadow mass
  deep: { lo: 0.085, hi: 0.135, sat: 0.5, gain: 1 },
  // hotter highlight
  hot: { lo: 0.26, hi: 0.36, sat: 0.78, gain: 1.35 },
}

export function groundTone(rgb: RGB, role: GroundRole): RGB {
  const spec = ROLE[role]
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  return hslToRgb(h, Math.min(s * spec.gain, spec.sat), Math.max(spec.lo, Math.min(l, spec.hi)))
}

// muted tint for the exposed bg
export function backgroundDepthColor(rgb: RGB): RGB {
  const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  return hslToRgb(h, Math.min(s, 0.28), 0.1)
}

export function surfaceTintColor(rgb: RGB): RGB {
  const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  return hslToRgb(h, Math.min(s, SURFACE_S_CAP), SURFACE_L)
}

// bloom behind the cover
const GLOW_L = 0.52
const GLOW_S_FLOOR = 0.35
const GLOW_S_CAP = 0.85

export function surfaceGlowColor(rgb: RGB): RGB {
  const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  return hslToRgb(h, Math.max(GLOW_S_FLOOR, Math.min(s * 1.2, GLOW_S_CAP)), GLOW_L)
}
