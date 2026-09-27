import { useEffect, useState } from 'react'
import { readJson } from '@/api/client'
import { API_BASE } from '@/config'

// somewhat annoying part of the flow right now
// TODO: make this more robust and less chances for a user to fall through a random error state
interface AuthState {
  required: boolean
  url: string | null
  loading: boolean // waits on the daemon
}

const POLL_MS = 2000
const POLL_TIMEOUT_MS = 4000

// polls /auth/status forever due to some potential error states the daemon throw us into
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    required: false,
    url: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    let timer = 0

    const tick = async () => {
      const ac = new AbortController()
      const timeoutId = window.setTimeout(() => ac.abort(), POLL_TIMEOUT_MS)
      try {
        const res = await fetch(`${API_BASE}/auth/status?t=${Date.now()}`, {
          cache: 'no-store',
          signal: ac.signal,
        })
        if (cancelled) return

        if (!res.ok) {
          // keep loading=true so we don't accidentally render the now playing
          setState((s) => (s.loading ? s : { ...s, loading: true }))
        } else {
          const data = (await readJson(res)) as {
            required?: boolean
            url?: string
            loading?: boolean
          }
          const required = data.required === true
          const url = required && typeof data.url === 'string' ? data.url : null
          const loading = data.loading === true
          setState({ required, url, loading })
        }
      } catch {
        if (cancelled) return
        setState((s) => (s.loading ? s : { ...s, loading: true }))
      } finally {
        window.clearTimeout(timeoutId)
      }

      if (!cancelled) {
        timer = window.setTimeout(tick, POLL_MS)
      }
    }

    void tick()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return state
}
