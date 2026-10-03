import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TopBanner, type BannerVariant, type BannerIcon } from '@/components/TopBanner'
import { NotifyContext, OverlayActivityContext, type NotifyFn } from './notifyContext'

const DEFAULT_DURATION_MS = 2600

interface BannerState {
  message: string
  variant: BannerVariant
  icon?: BannerIcon
  deviceType?: string
  visible: boolean
}

// owns the top-banner state and exposes notify() to the whole app thru context
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BannerState>({ message: '', variant: 'info', visible: false })
  const timerRef = useRef<number | undefined>(undefined)
  const [volumeVisible, setVolumeVisible] = useState(false)
  const activity = useMemo(
    () => ({ volumeVisible, setVolumeVisible, notificationVisible: state.visible }),
    [volumeVisible, state.visible],
  )
  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const notify = useCallback<NotifyFn>((message, opts) => {
    setState({
      message,
      variant: opts?.variant ?? 'info',
      icon: opts?.icon,
      deviceType: opts?.deviceType,
      visible: true,
    })
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setState((s) => ({ ...s, visible: false }))
    }, opts?.durationMs ?? DEFAULT_DURATION_MS)
  }, [])

  return (
    <NotifyContext.Provider value={notify}>
      <OverlayActivityContext.Provider value={activity}>
        {children}
        <TopBanner
          visible={state.visible}
          message={state.message}
          variant={state.variant}
          icon={state.icon}
          deviceType={state.deviceType}
          lowered={volumeVisible}
        />
      </OverlayActivityContext.Provider>
    </NotifyContext.Provider>
  )
}
