import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { darkBg, useColorExtract, type RGB } from '@/hooks/useColorExtract'
import { useActiveLine } from '@/hooks/useActiveLine'
import { useLyricStarts, useLyrics } from '@/hooks/useLyrics'
import { useNarration } from '@/hooks/useDJNarration'
import { useSettings } from '@/settings'
import { getUiScaleY, useUiScale } from '@/uiScale'
import type { LyricsWord, ObserverStatusActive } from '@/api/types'
import styles from './Lyrics.module.scss'

// playback position right now
function currentPosMs(status: ObserverStatusActive): number {
  const playing = status.is_playing && !status.is_paused
  const elapsed = playing ? Math.max(0, Date.now() - status.received_at) : 0
  return Math.min(status.duration, status.position + elapsed)
}

// highlight each word slightly before its true start
const KARAOKE_LEAD_MS = 90

function sungCount(syllables: LyricsWord[], posMs: number): number {
  let n = 0
  for (let i = 0; i < syllables.length; i++) {
    if (posMs + KARAOKE_LEAD_MS < parseInt(syllables[i].startTimeMs, 10)) break
    n = i + 1
  }
  return n
}

const KaraokeLine = memo(function KaraokeLine({
  syllables,
  status,
  onClick,
}: {
  syllables: LyricsWord[]
  status: ObserverStatusActive
  onClick?: () => void
}) {
  const [sung, setSung] = useState(() => sungCount(syllables, currentPosMs(status)))
  const maxSung = useRef(sung)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const n = sungCount(syllables, currentPosMs(status))
      if (n > maxSung.current) {
        maxSung.current = n
        setSung(n)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [syllables, status])

  const cls = `${styles.line} ${styles.lineActive}${onClick ? ` ${styles.lineClickable}` : ''}`
  return (
    <div
      className={cls}
      dir="auto"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
    >
      {syllables.map((w, i) => (
        <span key={i} className={i < sung ? styles.wordSung : styles.word}>
          {w.word}
        </span>
      ))}
    </div>
  )
})

interface Props {
  status: ObserverStatusActive
  onSeek?: (positionMs: number) => void
  active?: boolean
}

type LineVariant = 'active' | 'adjacent' | 'far' | 'unsynced'

function isInstrumental(lines: { words: string }[]): boolean {
  if (lines.length !== 1) return false
  const w = lines[0].words.trim()
  return /instrumental/i.test(w)
}

const ACTIVE_Y_RATIO = 0.33
const TALL_LINE_TOP_RATIO = 0.12
const SNAP_BACK_MS = 4000
const DRAG_THRESHOLD_PX = 8
const SEEK_HINT_TIMEOUT_MS = 2500

const LyricLine = memo(function LyricLine({
  text,
  variant,
  onClick,
}: {
  text: string
  variant: LineVariant
  onClick?: () => void
}) {
  const cls =
    variant === 'active'
      ? `${styles.line} ${styles.lineActive}`
      : variant === 'adjacent'
        ? `${styles.line} ${styles.lineAdjacent}`
        : variant === 'far'
          ? `${styles.line} ${styles.lineFar}`
          : `${styles.line} ${styles.lineUnsynced}`
  if (!onClick) {
    return (
      <div className={cls} dir="auto">
        {text}
      </div>
    )
  }
  return (
    <div
      className={`${cls} ${styles.lineClickable}`}
      dir="auto"
      role="button"
      tabIndex={0}
      onClick={onClick}
    >
      {text}
    </div>
  )
})

// the shell shared by the loading, empty and instrumental states
function LyricsState({
  children,
  style,
  ref,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  ref?: React.Ref<HTMLDivElement>
}) {
  return (
    <div className={`${styles.lyrics} ${styles.state}`} style={style} ref={ref}>
      <div className={styles.stateText}>{children}</div>
    </div>
  )
}

function LyricsImpl({ status, onSeek, active = true }: Props) {
  const isPodcast = status.track_uri.startsWith('spotify:episode:')
  // status points at the next song while the DJ speaks
  const { narrating } = useNarration()
  const { lyricOffsetMs, karaokeLyrics } = useSettings()
  // touch and wheel deltas arrive in viewport space; the scroll offset below is layout
  // space. they only agree at 100%. the hook value is here to re-run the measuring
  // effects; the handlers read the vertical scale directly at event time
  const uiScale = useUiScale()
  const { lyrics, loading, error } = useLyrics({
    trackId: status.track_id || null,
    trackName: status.track_name,
    artist: status.track_artist,
    album: status.track_album,
    durationMs: status.duration,
    episode: isPodcast,
    enabled: active && !narrating,
    karaoke: karaokeLyrics,
  })

  const color: RGB = useColorExtract(narrating ? '' : status.track_image)
  const starts = useLyricStarts(lyrics)
  const synced = lyrics?.syncType === 'LINE_SYNCED'
  const activeIdx = useActiveLine(status, synced ? starts : [], active, lyricOffsetMs)

  const [seekHint, setSeekHint] = useState<number | null>(null)
  const effIdx = seekHint ?? activeIdx

  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const lineMetrics = useRef<{ top: number; height: number }[]>([])
  const listHeight = useRef(0)

  const offset = useRef(0)
  const userActiveAt = useRef(0)
  const snapBackTimer = useRef(0)
  const dragStartY = useRef(0)
  const dragStartOffset = useRef(0)
  const dragging = useRef(false)

  const bgStyle = useMemo(() => {
    const bg = darkBg(color)
    return {
      '--lyrics-tint': bg,
      '--lyrics-bg-solid': bg,
    } as React.CSSProperties
  }, [color])

  const applyOffset = (instant = false) => {
    const list = listRef.current
    if (!list) return
    const viewport = viewportRef.current
    const maxOffset = viewport ? Math.max(0, listHeight.current - viewport.clientHeight) : 0
    if (offset.current < 0) offset.current = 0
    else if (offset.current > maxOffset) offset.current = maxOffset

    // 2d translate + whole-pixel offsets
    const y = -Math.round(offset.current)
    if (instant) {
      list.style.transition = 'none'
      list.style.transform = `translate(0, ${y}px)`
      void list.offsetHeight
      list.style.transition = ''
    } else {
      list.style.transform = `translate(0, ${y}px)`
    }
  }

  const computeAutoTarget = (): number => {
    const viewport = viewportRef.current
    if (!viewport || lineMetrics.current.length === 0) return 0
    const idx = effIdx < 0 ? 0 : effIdx
    const line = lineMetrics.current[idx]
    if (!line) return 0
    const centered = line.top - viewport.clientHeight * ACTIVE_Y_RATIO + line.height / 2
    const topAnchored = line.top - viewport.clientHeight * TALL_LINE_TOP_RATIO
    const desired = Math.min(centered, topAnchored)
    const maxOffset = Math.max(0, listHeight.current - viewport.clientHeight)
    return Math.max(0, Math.min(desired, maxOffset))
  }

  const snapBack = () => {
    userActiveAt.current = 0
    offset.current = computeAutoTarget()
    applyOffset()
  }

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) {
      lineMetrics.current = []
      listHeight.current = 0
      return
    }
    const lineNodes = list.querySelectorAll<HTMLElement>(`.${styles.line}`)
    const metrics: { top: number; height: number }[] = []
    for (let i = 0; i < lineNodes.length; i++) {
      const el = lineNodes[i]
      metrics.push({ top: el.offsetTop, height: el.offsetHeight })
    }
    lineMetrics.current = metrics
    listHeight.current = list.scrollHeight
    // the lyrics column is a 1fr track of a scale-dependent width, so a scale change
    // rewraps the lines and invalidates every cached top/height
  }, [lyrics, uiScale])

  useLayoutEffect(() => {
    if (Date.now() - userActiveAt.current < SNAP_BACK_MS) return
    offset.current = computeAutoTarget()
    applyOffset()
  }, [effIdx, lyrics, status.track_id, uiScale])

  useEffect(() => {
    if (seekHint == null) return
    if (activeIdx === seekHint) {
      setSeekHint(null)
      return
    }
    const t = window.setTimeout(() => setSeekHint(null), SEEK_HINT_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [seekHint, activeIdx])

  useEffect(() => {
    window.clearTimeout(snapBackTimer.current)
    userActiveAt.current = 0
    dragging.current = false
    offset.current = 0
    setSeekHint(null)
    applyOffset(true)
  }, [status.track_id])

  useEffect(
    () => () => {
      window.clearTimeout(snapBackTimer.current)
    },
    [],
  )

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    dragStartY.current = e.touches[0].clientY
    dragStartOffset.current = offset.current
    dragging.current = false
    window.clearTimeout(snapBackTimer.current)
  }

  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const y = e.touches[0].clientY
    if (!dragging.current) {
      if (Math.abs(dragStartY.current - y) < DRAG_THRESHOLD_PX) return
      dragging.current = true
      dragStartY.current = y
      dragStartOffset.current = offset.current
    }
    offset.current = dragStartOffset.current + (dragStartY.current - y) / getUiScaleY()
    applyOffset(true)
    userActiveAt.current = Date.now()
  }

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    if (dragging.current) {
      snapBackTimer.current = window.setTimeout(snapBack, SNAP_BACK_MS)
    }
  }

  const onLineTap = (idx: number, startMs: number) => {
    userActiveAt.current = 0
    window.clearTimeout(snapBackTimer.current)
    setSeekHint(idx)
    onSeek?.(startMs)
  }

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    offset.current += e.deltaY / getUiScaleY()
    applyOffset(true)
    userActiveAt.current = Date.now()
    window.clearTimeout(snapBackTimer.current)
    snapBackTimer.current = window.setTimeout(snapBack, SNAP_BACK_MS)
  }

  // the DJ has no lyrics, and useLyrics keeps the previous track's when disabled
  if (narrating) {
    return (
      <LyricsState style={bgStyle} ref={containerRef}>
        No lyrics available
      </LyricsState>
    )
  }

  if (loading) {
    return (
      <LyricsState style={bgStyle} ref={containerRef}>
        {isPodcast ? 'Loading transcript...' : 'Loading lyrics...'}
      </LyricsState>
    )
  }

  if (error || !lyrics || lyrics.lines.length === 0) {
    return (
      <LyricsState style={bgStyle} ref={containerRef}>
        {isPodcast ? 'No transcript available' : 'No lyrics available'}
      </LyricsState>
    )
  }

  if (isInstrumental(lyrics.lines)) {
    return (
      <LyricsState style={bgStyle} ref={containerRef}>
        ♪ Instrumental
      </LyricsState>
    )
  }

  return (
    <div className={styles.lyrics} style={bgStyle} ref={containerRef}>
      {!synced ? (
        <div className={styles.unsyncedPill} aria-label="lyrics are not time-synced">
          unsynced
        </div>
      ) : null}
      <div
        className={styles.viewport}
        ref={viewportRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onWheel={onWheel}
      >
        <div className={`${styles.list} ${synced ? styles.synced : styles.unsynced}`} ref={listRef}>
          <div className={styles.padTop} aria-hidden />
          {lyrics.lines.map((line, i) => {
            const variant: LineVariant = !synced
              ? 'unsynced'
              : i === effIdx
                ? 'active'
                : Math.abs(i - effIdx) === 1 && effIdx >= 0
                  ? 'adjacent'
                  : 'far'
            const startMs = synced ? starts[i] : undefined
            const onClick =
              !status.disallow_seek && onSeek && typeof startMs === 'number' && startMs >= 0
                ? () => onLineTap(i, startMs)
                : undefined
            if (karaokeLyrics && i === effIdx && line.syllables && line.syllables.length > 0) {
              return (
                <KaraokeLine key={i} syllables={line.syllables} status={status} onClick={onClick} />
              )
            }
            return (
              <LyricLine key={i} text={line.words || '♪'} variant={variant} onClick={onClick} />
            )
          })}
          <div className={styles.padBottom} aria-hidden />
        </div>
      </div>
    </div>
  )
}

export const Lyrics = memo(LyricsImpl)
