import { BootSplash } from '@/components/BootSplash'

/** shown once the wait is long enough that it reads as broken rather than slow */
const STUCK_HINT =
  'Still connecting to Spotify if this persists for another minute, try unplugging and replugging.'

export type BootPhase = 'starting' | 'setting-up'

export interface BootPageProps {
  /** 'setting-up' is the first-ever boot fetching a library catalog */
  phase: BootPhase
  stuck?: boolean
  progress?: number | null
}

export function BootPage({ phase, stuck, progress }: BootPageProps) {
  if (phase === 'setting-up') {
    return <BootSplash caption="setting things up" progress={progress ?? null} />
  }
  return <BootSplash caption="starting up" hint={stuck ? STUCK_HINT : undefined} />
}
