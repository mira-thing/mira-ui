import { useCallback, useMemo } from 'react'
import { addToQueue } from '@/api/client'
import { useNotify } from '@/notify/notifyContext'

// app-wide, so a double press queues once even if the pressed row remounts in between
const pending = new Set<string>()

export interface QueueActions {
  /**
   * Queues `uri` and banners the outcome. `label`, such as the track title, names it in the
   * banner. Resolves true once queued; false on failure, or while that uri is already on its way.
   */
  add: (uri: string, label?: string) => Promise<boolean>
}

/** What can be done to the queue from anywhere in the app: for now, adding to it. */
export function useQueueActions(): QueueActions {
  const notify = useNotify()

  const add = useCallback(
    async (uri: string, label?: string) => {
      if (pending.has(uri)) return false
      pending.add(uri)
      try {
        await addToQueue(uri)
        notify(label ? `Added ${label} to the queue` : 'Added to the queue', {
          variant: 'success',
          icon: 'queue',
        })
        return true
      } catch {
        notify("Couldn't add to the queue", { variant: 'error' })
        return false
      } finally {
        pending.delete(uri)
      }
    },
    [notify],
  )

  return useMemo(() => ({ add }), [add])
}
