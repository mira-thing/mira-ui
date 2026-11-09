import { memo, useEffect, useState } from 'react'
import styles from './DebugScreen.module.scss'
import { fetchDebugStatus, sendDebugReport } from '@/api/client'
import type { DebugStatus } from '@/api/types'
import { Layer } from '@/input/router'
import { useKnobScope } from '@/input/useKnobScope'

interface Props {
  open: boolean
  onClose: () => void
  onReport: (id: string) => void
}

type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

function Row({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${styles[tone]}`}>{value}</span>
    </div>
  )
}

function Section({ title }: { title: string }) {
  return <div className={styles.section}>{title}</div>
}

function phoneTone(s: string): Tone {
  if (s === 'connected') return 'ok'
  if (s.startsWith('unavailable')) return 'bad'
  if (s === 'disconnected') return 'warn'
  return 'neutral'
}

function fmtUptime(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

function tempTone(c: number): Tone {
  if (c >= 85) return 'bad'
  if (c >= 70) return 'warn'
  return 'ok'
}

function ramTone(free: number): Tone {
  if (free < 30) return 'bad'
  if (free < 60) return 'warn'
  return 'ok'
}

function StatusView({ status }: { status: DebugStatus }) {
  return (
    <>
      <Section title="System" />
      <Row
        label="Firmware"
        value={status.firmware_version}
        tone={status.firmware_version === 'unknown' ? 'warn' : 'ok'}
      />
      <Row label="Daemon" value={status.daemon_version} />
      <Row label="Uptime" value={fmtUptime(status.uptime_secs)} />
      <Row
        label="Daemon uptime"
        value={fmtUptime(status.daemon_uptime_secs)}
        tone={status.daemon_uptime_secs + 120 < status.uptime_secs ? 'warn' : 'ok'}
      />
      <Row label="Clock" value={status.clock_time} tone={status.clock_ok ? 'ok' : 'warn'} />
      <Row
        label="RAM free"
        value={`${status.ram_free_mb} / ${status.ram_total_mb} MB`}
        tone={ramTone(status.ram_free_mb)}
      />
      <Row
        label="Storage free"
        value={`${status.disk_free_mb} MB`}
        tone={status.disk_free_mb < 20 ? 'bad' : 'ok'}
      />
      {status.temp_c > 0 && (
        <Row label="SoC temp" value={`${status.temp_c}°C`} tone={tempTone(status.temp_c)} />
      )}
      {status.load_1m && (
        <Row
          label="CPU load (1m)"
          value={status.load_1m}
          tone={parseFloat(status.load_1m) > 3.5 ? 'warn' : 'neutral'}
        />
      )}
      <Row
        label="UI websocket"
        value={status.ws_clients > 0 ? `${status.ws_clients} connected` : 'none'}
        tone={status.ws_clients > 0 ? 'ok' : 'warn'}
      />

      <Section title="Network" />
      <Row
        label="Internet"
        value={status.online ? 'online' : 'offline'}
        tone={status.online ? 'ok' : 'bad'}
      />
      <Row
        label="Path"
        value={status.network_path === 'none' ? 'none' : `${status.network_path} ${status.ip}`}
        tone={status.network_path === 'none' ? 'bad' : 'ok'}
      />
      <Row
        label="DNS servers"
        value={String(status.dns_servers)}
        tone={status.dns_servers > 0 ? 'ok' : 'bad'}
      />
      <Row
        label="Internet drops"
        value={String(status.internet_drops)}
        tone={status.internet_drops > 3 ? 'bad' : status.internet_drops > 0 ? 'warn' : 'ok'}
      />
      <Row
        label="USB re-enumerations"
        value={String(status.usb_bounces)}
        tone={status.usb_bounces > 0 ? 'warn' : 'ok'}
      />
      {status.tether_health && (
        <Row
          label="Tether route"
          value={status.tether_health}
          tone={status.tether_health === 'ok' ? 'ok' : 'bad'}
        />
      )}

      <Section title="Spotify" />
      <Row
        label="Account"
        value={status.spotify}
        tone={
          status.spotify.startsWith('signed in')
            ? 'ok'
            : status.spotify === 'waiting for sign-in'
              ? 'warn'
              : 'neutral'
        }
      />

      <Section title="Phone volume" />
      <Row
        label="Connected phone"
        value={status.bluetooth_device || 'none'}
        tone={status.bluetooth_device ? 'ok' : 'neutral'}
      />
      <Row
        label="iPhone (iAP2)"
        value={status.phone_volume}
        tone={phoneTone(status.phone_volume)}
      />
      {status.phone_volume_err && (
        <div className={styles.errorLine}>iAP2 error: {status.phone_volume_err}</div>
      )}
      <Row
        label="Android (HID)"
        value={status.android_volume}
        tone={
          status.android_volume === 'ready'
            ? 'ok'
            : status.android_volume === 'off'
              ? 'neutral'
              : 'warn'
        }
      />

      <Section title="Voice" />
      <Row
        label="Voice"
        value={!status.voice_enabled ? 'off' : status.voice_ready ? 'ready' : 'loading'}
        tone={!status.voice_enabled ? 'neutral' : status.voice_ready ? 'ok' : 'warn'}
      />

      <div className={styles.problems}>
        <div className={styles.problemsTitle}>Recent problems</div>
        {(status.recent_problems ?? []).length === 0 ? (
          <div className={styles.problemNone}>none</div>
        ) : (
          status.recent_problems.map((p, i) => (
            <div key={i} className={styles.problem}>
              {p}
            </div>
          ))
        )}
      </div>

      {(status.previous_problems ?? []).length > 0 && (
        <div className={styles.problems}>
          <div className={styles.problemsTitle}>Previous run</div>
          {status.previous_problems.map((p, i) => (
            <div key={i} className={styles.problem}>
              {p}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// uploads the support bundle
function SendReportButton({ onReport }: { onReport: (id: string) => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const [detail, setDetail] = useState('')
  const onSend = () => {
    if (state === 'sending') return
    setState('sending')
    sendDebugReport()
      .then((id) => {
        setState('idle')
        onReport(id)
      })
      .catch((e) => {
        setState('error')
        setDetail(String(e?.message ?? e).slice(0, 60))
      })
  }
  return (
    <>
      {state === 'error' && <span className={styles.reportErr}>{detail}</span>}
      <button className={styles.close} onClick={onSend} disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send report'}
      </button>
    </>
  )
}

function DebugScreenImpl({ open, onClose, onReport }: Props) {
  const [status, setStatus] = useState<DebugStatus | null>(null)
  const [err, setErr] = useState(false)
  // keeps the knob off a menu left open underneath
  useKnobScope({ layer: Layer.system, enabled: open, onStep: () => true, onSelect: () => true })

  useEffect(() => {
    if (!open) return
    let alive = true
    const load = async () => {
      try {
        const s = await fetchDebugStatus()
        if (alive) {
          setStatus(s)
          setErr(false)
        }
      } catch {
        if (alive) setErr(true)
      }
    }
    void load()
    const id = window.setInterval(load, 1500)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [open])

  if (!open) return null

  return (
    <div className={styles.root} role="dialog" aria-modal="true">
      <div className={styles.header}>
        <span className={styles.title}>Debug</span>
        <div className={styles.headerBtns}>
          <SendReportButton onReport={onReport} />
          <button className={styles.close} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {err && !status && <div className={styles.err}>daemon not responding on :3678</div>}
        {status && <StatusView status={status} />}
      </div>

      <div className={styles.hint}>Press back to exit</div>
    </div>
  )
}

export const DebugScreen = memo(DebugScreenImpl)
