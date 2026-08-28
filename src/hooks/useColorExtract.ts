import { useEffect, useRef, useState } from 'react'

export type RGB = [number, number, number]

// the art is reduced to a 5-bit histogram
const DEFAULT: RGB = [70, 75, 95]
const SAMPLE = 32
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

// the accent colour plus how bright the artwork is overall
interface Sample {
  rgb: RGB
  luminance: number
}

const DEFAULT_SAMPLE: Sample = { rgb: DEFAULT, luminance: 0 }

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
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  sharedCtx = canvas.getContext('2d', { willReadFrequently: true })
  return sharedCtx
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

function meanLuminance(data: ArrayLike<number>): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    n++
  }
  return n === 0 ? 0 : sum / n / 255
}

function extract(img: HTMLImageElement): Sample | null {
  const ctx = ensureCanvas()
  if (!ctx) return null
  try {
    ctx.clearRect(0, 0, SAMPLE, SAMPLE)
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
    const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE)
    const rgb = extractAccent(data)
    if (!rgb) return null
    return { rgb, luminance: meanLuminance(data) }
  } catch {
    return null
  }
}

function useSample(url: string | undefined): Sample {
  const [sample, setSample] = useState<Sample>(() =>
    url ? (cache.get(url) ?? DEFAULT_SAMPLE) : DEFAULT_SAMPLE,
  )
  const lastUrlRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!url) {
      setSample(DEFAULT_SAMPLE)
      lastUrlRef.current = undefined
      return
    }
    if (lastUrlRef.current === url) return
    lastUrlRef.current = url

    const cached = cache.get(url)
    if (cached) {
      setSample(cached)
      return
    }

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.referrerPolicy = 'no-referrer'

    const apply = (next: Sample) =>
      setSample((prev) =>
        prev.rgb[0] === next.rgb[0] &&
        prev.rgb[1] === next.rgb[1] &&
        prev.rgb[2] === next.rgb[2] &&
        prev.luminance === next.luminance
          ? prev
          : next,
      )

    img.onload = () => {
      if (cancelled) return
      const next = extract(img) ?? DEFAULT_SAMPLE
      remember(url, next)
      apply(next)
    }
    img.onerror = () => {
      if (cancelled) return
      apply(DEFAULT_SAMPLE)
    }
    img.src = url

    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
      img.src = ''
    }
  }, [url])

  return sample
}

export function useColorExtract(url: string | undefined): RGB {
  return useSample(url).rgb
}

// mean artwork luminance
export function useArtLuminance(url: string | undefined): number {
  return useSample(url).luminance
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

// saturated darkmode backdrop from the album accent colour
export function darkBg(rgb: RGB): string {
  const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const [r, g, b] = hslToRgb(h, Math.min(s, DARK_S_CAP), DARK_L)
  return `rgb(${r}, ${g}, ${b})`
}
