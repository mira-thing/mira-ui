import { useEffect } from 'react'
import type { ObserverStatus } from '@/api/types'
import { SPONSOR_SHOWN_KEY } from './useOverlays'

const FLASH_ID_KEY = 'mira.flashId'

const PER_FLASH_KEYS = [SPONSOR_SHOWN_KEY]

export function useFlashReset(status: ObserverStatus | null): void {
  const flashId = status?.flash_id ?? ''
  useEffect(() => {
    if (!flashId) return
    try {
      if (window.localStorage.getItem(FLASH_ID_KEY) === flashId) return
      for (const key of PER_FLASH_KEYS) window.localStorage.removeItem(key)
      window.localStorage.setItem(FLASH_ID_KEY, flashId)
    } catch {
      // ignore
    }
  }, [flashId])
}
